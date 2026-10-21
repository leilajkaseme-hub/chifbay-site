#!/usr/bin/env python3
"""Bring the Reels already built on the Mac (ig-auto/reels-plan.json, not posted yet) into shorts/plan.json.

    python3 shorts/import_legacy.py r18-standup r19-wake ...

They keep their id (so the Instagram ledger can never post one twice), their video, preview and cover on
chifbay.com, their Instagram caption and hook. New: a designed thumbnail, and the texts for Facebook, Threads,
YouTube and TikTok (Gemini). They wait for Theo's OK on the review page like every other video.
"""
import json, pathlib, sys, tempfile, time, urllib.request
from lib import PLAN, SITE, log, media_put, read_json, write_json
from plan import CUTS, text_problems, write_texts
from render import thumbnail


def main():
    want = sys.argv[1:]
    old = {r["id"]: r for r in read_json(SITE / "ig-auto" / "reels-plan.json", {"reels": []})["reels"]}
    plan = read_json(PLAN, {"videos": []})
    have = {v["id"] for v in plan["videos"]}
    recent = [v["texts"]["hook"] for v in plan["videos"] if v.get("texts")]
    for rid in want:
        r = old.get(rid)
        if not r or rid in have:
            log(f"{rid}: {'not found' if not r else 'already in the plan'}")
            continue
        shots = []
        for s in r["shots"]:
            stem = s["file"].rsplit(".", 1)[0]
            name, off = CUTS.get(stem, (s["file"], 0.0))
            shots.append({"name": name, "start": round(off + s["in"], 2), "len": round(s["out"] - s["in"], 2),
                          "speed": s.get("speed", 1), "what": s.get("what", ""), "tags": [], "file_id": None})
        cta = r["caption"].strip().splitlines()[-1].strip()
        fmt = "montage" if len(shots) > 1 else "highlight"
        v = {"id": rid, "format": fmt, "status": "rendered", "legacy": True, "created": time.strftime("%Y-%m-%d"),
             "shots": shots, "music": "", "audio": "", "cta": cta, "light": r["shots"][0].get("grade", "")}
        t = write_texts(v, recent)
        t["ig"], t["hashtags"], t["hook"] = r["caption"], r["hashtags"], r["hook"]
        t["alt"] = r.get("alt") or t["alt"]
        v["texts"] = t
        with tempfile.TemporaryDirectory() as td:
            cover = pathlib.Path(td) / "cover.jpg"
            urllib.request.urlretrieve(r["clean_cover"], cover)
            th = pathlib.Path(td) / "thumb.jpg"
            thumbnail(cover, t.get("thumb") or r["hook"], th)
            thumb_url = media_put(f"{rid}-thumb.jpg", th, "image/jpeg")
        v["render"] = {"video": r["video"], "preview": r["preview"], "cover": r["clean_cover"], "thumb": thumb_url,
                       "duration": r["duration"], "bytes": r["bytes"], "checks": r["checks"],
                       "shots": [{"name": s["name"], "in": s["start"], "speed": s["speed"], "what": s["what"]} for s in shots],
                       "at": r["checks"].get("at")}
        plan["videos"].append(v)
        recent.append(t["hook"])
        write_json(PLAN, plan)
        log(f"{rid}: imported, YouTube title: {t['yt_title']}")


if __name__ == "__main__":
    main()
