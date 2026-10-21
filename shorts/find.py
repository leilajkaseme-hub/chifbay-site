#!/usr/bin/env python3
"""Find the best moments in every trip video on the Drive (runs on GitHub, workflow shorts-find.yml).

    python3 shorts/find.py              scan the videos not scanned yet
    python3 shorts/find.py --max 5      at most 5 files this run
    python3 shorts/find.py --again NAME scan this file again

Most "viral clip" tools pick moments from what people SAY (transcript). Boat footage has no talking, so
this one looks at the picture:
  1. ffmpeg streams the file from the Drive and makes a small copy (640 px, 10 fps, sound kept).
  2. From that copy: motion, loudness and sharpness every 0.5 s (numbers, no AI).
  3. Gemini (free tier) watches the small copy and lists the moments that would open a Reel well,
     with a score, what happens, tags, where the subject sits for a vertical crop, and any problem.
The result is shorts/moments.json. plan.py builds the videos from it. Nothing is posted here.
"""
import json, os, pathlib, sys, tempfile, time
import numpy as np
from lib import (MOMENTS, QuotaGone, drive_input, drive_videos, gemini, gemini_delete, gemini_keys, gemini_upload,
                 key_spent, log, probe_drive, read_json, run, write_json)

VERSION = 1
STEP = 0.5            # seconds per stats bucket
TIME_BUDGET = float(os.environ.get("FIND_BUDGET_MIN", "320")) * 60   # stop before GitHub's 6 h limit
TAGS = ["jump", "swim", "paddle", "splash", "speed", "wake", "boat_hero", "aerial", "topdown", "orbit", "reveal",
        "cliffs", "cave", "waterfall", "cove", "turquoise", "open_sea", "funchal", "marina", "sunset", "golden_light",
        "guests_happy", "couple", "family", "food_drinks", "skipper", "dolphins", "wildlife", "slow_motion_worthy",
        "loop_worthy", "calm", "details"]
ISSUES = ["shaky", "blurry", "dark", "watermark", "text_overlay", "transition", "nothing_happens", "ground_or_land",
          "drone_takeoff_landing", "camera_operator_visible", "crowded", "faces_very_close", "kids_close", "other_boats_brand",
          "body_focus"]

PROMPT = f"""You are the video editor of Chifbay, a small family business that runs private boat trips from Funchal,
Madeira (one Karnic R8S boat with "Chifbay.com" on the bimini, two skippers, at most 5 guests). This is RAW footage
from our trips: drone, phone or 360 camera. Find the moments that would make a strong vertical Reel, YouTube Short
or TikTok of 5 to 15 seconds, or one shot inside a short montage.

Answer with JSON only, in this shape:
{{
 "boat_trip": true or false,      // false if this is not footage of a trip at sea (tests on land, roofs, parking, ground)
 "camera": "drone" | "phone" | "360" | "edit" | "other",   // "edit" = already edited (cuts, titles, transitions)
 "light": "day" | "golden" | "sunset" | "night" | "overcast",
 "summary": "one plain sentence about the whole file",
 "moments": [
  {{
   "start": 12.5, "end": 18.0,    // seconds from the start of THIS video, precise to 0.5 s, 2 to 10 s long, no overlap
   "peak": 15.0,                  // the instant of the payoff (jump hits the water, the boat passes, the reveal)
   "score": 1-10,                 // how good this is as a Reel moment for a boat-trip company
   "hook": 1-10,                  // how much the FIRST second of it stops someone scrolling
   "what": "what happens, plainly, no hype",
   "tags": [ from {json.dumps(TAGS)} ],
   "subject_x": 0.0-1.0,          // horizontal position of the main subject at "start" (0 = left edge), for a 9:16 crop
   "subject_x_end": 0.0-1.0,      // same at "end"
   "people": "none" | "far" | "medium" | "close",
   "issues": [ from {json.dumps(ISSUES)} ]
  }}
 ]
}}

Rules:
- List EVERY usable moment, best and average, up to 30. Skip only the unusable ones.
- Strong: motion with a payoff (a jump, a splash, the boat turning or passing close, a reveal of the coast), the boat
  itself looking great, the Cabo Girao cliffs, caves, clear turquoise water, sunset light, guests clearly having fun.
- Weak: empty sea with nothing happening, the ground, the drone taking off or landing, a shaky handheld pan, the
  marina car park.
- Never invent wildlife: tag dolphins only if you clearly see them.
- Flag "body_focus" when the shot mostly shows a guest's body in swimwear (from behind, close on skin) rather than the
  place, the boat or what the guests are doing. A family business never posts that.
- Times must be inside the video. Be precise: the editor cuts on your numbers.
"""


def proxy(file_id, out):
    """Small copy for Gemini and for the numbers: the long side at 640 px, 10 fps, mono sound."""
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", *drive_input(file_id),
         "-vf", "scale='if(gt(iw,ih),640,-2)':'if(gt(iw,ih),-2,640)',fps=10",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-c:a", "aac", "-ac", "1", "-b:a", "48k",
         "-movflags", "+faststart", str(out)])


def numbers(path, dur):
    """Motion (mean frame change), loudness (RMS) and sharpness every 0.5 s, each scaled 0..100."""
    w, h = 64, 36
    raw = run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-vf", f"scale={w}:{h},format=gray",
               "-f", "rawvideo", "-"], text=False)
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    per = int(10 * STEP)
    n = max(1, int(np.ceil(dur / STEP)))
    diff = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2)) if len(fr) > 1 else np.zeros(1)
    lap = np.abs(fr[:, 1:-1, 1:-1] * 4 - fr[:, :-2, 1:-1] - fr[:, 2:, 1:-1] - fr[:, 1:-1, :-2] - fr[:, 1:-1, 2:]).mean(axis=(1, 2))
    motion = [float(diff[i * per:(i + 1) * per].mean()) if diff[i * per:(i + 1) * per].size else 0.0 for i in range(n)]
    sharp = [float(lap[i * per:(i + 1) * per].mean()) if lap[i * per:(i + 1) * per].size else 0.0 for i in range(n)]
    try:
        pcm = run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "8000",
                   "-f", "s16le", "-"], text=False)
        a = np.frombuffer(pcm, np.int16).astype(np.float32)
        k = int(8000 * STEP)
        loud = [float(np.sqrt((a[i * k:(i + 1) * k] ** 2).mean())) if a[i * k:(i + 1) * k].size else 0.0 for i in range(n)]
    except RuntimeError:
        loud = [0.0] * n
    scale = lambda v, top: [int(min(100, round(100 * x / top))) if top else 0 for x in v]
    return {"step": STEP, "motion": scale(motion, 12.0), "loud": scale(loud, 6000.0), "sharp": scale(sharp, 40.0)}


def clean(moments, dur):
    out, last_end = [], -1
    for m in sorted(moments or [], key=lambda m: float(m.get("start", 0))):
        try:
            s, e = round(float(m["start"]) * 2) / 2, round(float(m["end"]) * 2) / 2
        except (KeyError, TypeError, ValueError):
            continue
        s, e = max(0.0, s), min(dur, e)
        if e - s < 1.5 or s < last_end:
            continue
        pk = float(m.get("peak", (s + e) / 2))
        out.append({
            "start": s, "end": e, "peak": round(min(max(pk, s), e), 1),
            "score": int(m.get("score", 0)), "hook": int(m.get("hook", 0)), "what": str(m.get("what", ""))[:240],
            "tags": [t for t in m.get("tags", []) if t in TAGS],
            "x": round(min(1, max(0, float(m.get("subject_x", 0.5)))), 2),
            "x2": round(min(1, max(0, float(m.get("subject_x_end", m.get("subject_x", 0.5))))), 2),
            "people": m.get("people", "none"), "issues": [i for i in m.get("issues", []) if i in ISSUES],
        })
        last_end = e
    return out


def checkpoint(done):
    """Save the work so far to the repo (a long run can take hours; render can start on what is there)."""
    import subprocess
    root = str(MOMENTS.parent.parent)
    subprocess.run(["git", "add", "shorts/moments.json"], cwd=root)
    if subprocess.run(["git", "diff", "--staged", "--quiet"], cwd=root).returncode:
        subprocess.run(["git", "commit", "-qm", f"shorts: moments, {done} files scanned so far"], cwd=root)
        subprocess.run(["scripts/ci-push.sh"], cwd=root)


def main():
    args = sys.argv[1:]
    cap = int(args[args.index("--max") + 1]) if "--max" in args else 999
    again = set(args[args.index("--again") + 1].split(",")) if "--again" in args else set()
    db = read_json(MOMENTS, {"version": VERSION, "files": {}})
    files = drive_videos()
    # a copy scanned before MD5 was compared (e.g. "x.MP4" and "x (1).MP4") is dropped: its windows would look unused
    keep = {f["id"] for f in files}
    for fid in [k for k in db["files"] if k not in keep]:
        log(f"  dropping {db['files'][fid]['name']}: a copy of another file, or gone from the Drive")
        del db["files"][fid]
    for f in files:
        if f["id"] in db["files"] and f.get("md5Checksum"):
            db["files"][f["id"]]["md5"] = f["md5Checksum"]
    log(f"{len(files)} videos on the Drive, {len(db['files'])} already scanned")
    started, done = time.time(), 0
    todo = [f for f in files if f["size"] > 3e6 and (f["id"] not in db["files"] or f["name"] in again
                                                     or db["files"][f["id"]].get("version") != VERSION
                                                     or (db["files"][f["id"]].get("error") and db["files"][f["id"]].get("tries", 0) < 3))]
    # Real trip footage first (Theo, 21 Oct 2026: the footage of the first videos was weak): the drone flights of the
    # trips (PUBLISH/USED and the client drone folder), then phone clips, and last the June test flights over land.
    def priority(f):
        p, n = f["path"].lower(), f["name"].lower()
        if "dji drone videos/" in p:
            return 3
        if n.startswith("dji_") or "insta360" in p or n.startswith("814009287"):
            return 0
        if n.startswith("img_"):
            return 1
        return 2
    todo.sort(key=lambda f: (priority(f), f["size"]))
    for f in todo:
        if done >= cap or time.time() - started > TIME_BUDGET:
            log("stopping here (cap or time budget): the next run carries on")
            break
        log(f"- {f['path']} ({f['size'] / 1e6:.0f} MB)")
        rec = {"name": f["name"], "path": f["path"], "size": f["size"], "created": f.get("createdTime", "")[:10], "md5": f.get("md5Checksum"),
               "version": VERSION, "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        try:
            rec.update(probe_drive(f["id"]))
            with tempfile.TemporaryDirectory() as tmp:
                px = pathlib.Path(tmp) / "proxy.mp4"
                t0 = time.time()
                proxy(f["id"], px)
                log(f"  proxy {px.stat().st_size / 1e6:.1f} MB in {time.time() - t0:.0f} s")
                rec["stats"] = numbers(px, rec["dur"])
                ans = None
                for key in gemini_keys():          # a key whose free calls are spent hands over to the next
                    if key_spent(key):
                        continue
                    uri, name = gemini_upload(px, key=key)
                    try:
                        ans, model = gemini([{"file_data": {"mime_type": "video/mp4", "file_uri": uri}}, {"text": PROMPT}],
                                            media_low=rec["dur"] > 240, key=key)
                        break
                    except QuotaGone:
                        continue
                    finally:
                        gemini_delete(name, key=key)
                if ans is None:
                    raise QuotaGone("all Gemini keys are spent for today")
            rec.update(boat=bool(ans.get("boat_trip")), camera=ans.get("camera", "other"), light=ans.get("light", "day"),
                       summary=str(ans.get("summary", ""))[:300], model=model, moments=clean(ans.get("moments"), rec["dur"]))
            log(f"  {model}: boat={rec['boat']} {rec['camera']} {rec['light']}, {len(rec['moments'])} moments, "
                f"best {max([m['score'] for m in rec['moments']] or [0])}/10 :: {rec['summary'][:90]}")
        except QuotaGone as e:
            log(f"  {e}: stopping, tomorrow's run carries on")
            break
        except Exception as e:  # one bad file must not stop the others
            rec["error"] = str(e)[:300]
            rec["tries"] = db["files"].get(f["id"], {}).get("tries", 0) + 1
            log(f"  FAILED: {rec['error']}")
        db["files"][f["id"]] = rec
        write_json(MOMENTS, db)
        done += 1
        if os.environ.get("FIND_COMMIT_EVERY") and done % int(os.environ["FIND_COMMIT_EVERY"]) == 0:
            checkpoint(done)
    usable = [m for r in db["files"].values() if r.get("boat") for m in r.get("moments", []) if m["score"] >= 6]
    log(f"{done} scanned this run; {len(usable)} moments scored 6/10 or more in {len(db['files'])} files")


if __name__ == "__main__":
    main()
