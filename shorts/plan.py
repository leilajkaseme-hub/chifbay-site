#!/usr/bin/env python3
"""Plan new short videos from the moments in shorts/moments.json (runs on GitHub, workflow shorts-make.yml).

    python3 shorts/plan.py            add videos until 16 are waiting (not posted, not refused)
    python3 shorts/plan.py --add 6    add 6 more whatever is waiting
    python3 shorts/plan.py --dry      print what it would add, write nothing

Rules, so the feed never repeats itself (Theo, 19 Oct 2026: "never re-plan the same videos"):
- The same seconds of footage never come back: a shot may not overlap (1 s margin) anything already used in a
  Reel, a story clip or another planned video.
- One source file at most once in any 3 videos in a row.
- The format rotates (highlight, montage, POV, list, question, loop, best of) so two days never look alike.
Each new video gets its texts for every platform from Gemini (free tier), checked by rules below.
Nothing is posted here: a video waits for Theo's OK on the review page.
"""
import json, re, sys, time
from lib import MOMENTS, PLAN, SITE, gemini, log, read_json, write_json

WAITING_TARGET = 16
BAD = {"shaky", "blurry", "dark", "watermark", "text_overlay", "transition", "nothing_happens", "ground_or_land",
       "drone_takeoff_landing", "camera_operator_visible", "kids_close", "other_boats_brand"}
THEMES = {
    "swim": {"swim", "jump", "paddle", "splash", "turquoise", "cove"},
    "coast": {"cliffs", "cave", "waterfall", "reveal", "funchal", "cove"},
    "ride": {"speed", "wake", "boat_hero", "open_sea", "orbit", "aerial", "topdown"},
    "sunset": {"sunset", "golden_light"},
    "people": {"guests_happy", "couple", "family", "food_drinks", "skipper"},
}
# How each format is cut: number of shots, seconds per shot (on screen), total range.
FORMATS = {
    "highlight": {"shots": 1, "len": (5.0, 8.0), "total": (5.0, 9.0)},
    "montage":   {"shots": 3, "len": (2.6, 3.6), "total": (8.5, 12.5)},
    "pov":       {"shots": 2, "len": (3.2, 4.6), "total": (7.0, 10.0)},
    "list":      {"shots": 3, "len": (2.8, 3.6), "total": (9.0, 12.0)},
    "question":  {"shots": 1, "len": (5.0, 7.5), "total": (5.0, 8.0)},
    "loop":      {"shots": 1, "len": (4.0, 6.0), "total": (4.0, 6.5)},
    "bestof":    {"shots": 5, "len": (1.8, 2.4), "total": (9.5, 12.5)},
}
ROTATION = ["highlight", "montage", "pov", "highlight", "list", "question", "montage", "loop",
            "highlight", "pov", "montage", "bestof", "question", "highlight"]
CTAS = ["Booking link in bio.", "Dates and booking on chifbay.com.", "Message us to pick your day.",
        "Book your day on chifbay.com.", "Ask us for a date in the DMs.", "Tap the link in our bio to book."]

# Windows used before this system existed (Reels r01 to r26, built on the Mac from cuts of the big drone files).
CUTS = {"c5a": ("DJI_20260811111635_0005_D.MP4", 13.8), "c5b": ("DJI_20260811111635_0005_D.MP4", 23.6),
        "c5c": ("DJI_20260811111635_0005_D.MP4", 46.4), "c9a": ("DJI_20260812144130_0009_D.MP4", 3.3),
        "c9b": ("DJI_20260812144130_0009_D.MP4", 19.3), "c9c": ("DJI_20260812144130_0009_D.MP4", 31.8),
        "c3a": ("DJI_20260811102620_0003_D.MP4", 36.8), "c3b": ("DJI_20260811102620_0003_D.MP4", 41.4),
        "c3c": ("DJI_20260811102620_0003_D.MP4", 70.8), "c30a": ("DJI_20260813191642_0030_D.MP4", 11.8),
        "c30b": ("DJI_20260813191642_0030_D.MP4", 17.8), "c30c": ("DJI_20260813191642_0030_D.MP4", 36.8)}


def used_windows(plan):
    """{file name: [(start, end)]} for every second of footage already used anywhere."""
    used = {}
    add = lambda name, a, b: used.setdefault(name, []).append((float(a), float(b)))
    old = read_json(SITE / "ig-auto" / "reels-plan.json", {"reels": []})
    for r in old.get("reels", []):
        for s in r.get("shots", []):
            stem = s["file"].rsplit(".", 1)[0]
            if stem in CUTS:
                name, off = CUTS[stem]
                add(name, off + s["in"], off + s["out"])
            else:
                add(s["file"], s["in"], s["out"])
    for c in read_json(SITE / "ig-auto" / "reels.json", {"clips": []}).get("clips", []):
        if c.get("source"):
            add(c["source"], c["start"], c["start"] + c["len"])
    for v in plan.get("videos", []):
        if v.get("status") == "retired" and not v.get("posted"):
            continue
        for s in v.get("shots", []):
            add(s["name"], s["start"], s["start"] + s["len"])
    return used


def free(used, name, a, b, margin=1.0):
    return all(b + margin <= u0 or a - margin >= u1 for u0, u1 in used.get(name, []))


def pool(moments, used):
    out = []
    for fid, f in moments.get("files", {}).items():
        if not f.get("boat") or f.get("camera") == "edit" or f.get("error"):
            continue
        for m in f.get("moments", []):
            if m["score"] < 6 or BAD & set(m["issues"]):
                continue
            if not free(used, f["name"], m["start"], m["end"]):
                continue
            q = 0.6 * m["score"] + 0.4 * m["hook"]
            st = f.get("stats") or {}
            i0, i1 = int(m["start"] / 0.5), max(int(m["start"] / 0.5) + 1, int(m["end"] / 0.5))
            sharp = st.get("sharp", [])[i0:i1]
            if sharp and sum(sharp) / len(sharp) < 8:
                q -= 1.5          # soft focus all through
            out.append({**m, "file_id": fid, "name": f["name"], "fps": f.get("fps", 30), "w": f.get("w"), "h": f.get("h"),
                        "camera": f.get("camera"), "light": f.get("light"), "created": f.get("created", ""), "q": round(q, 2),
                        "loud": st.get("loud", [])[i0:i1]})
    return sorted(out, key=lambda m: -m["q"])


def slow_ok(m):
    """Slow motion only where the source has the frames (60 fps drone) and the moment is worth slowing."""
    return m["fps"] >= 50 and bool({"slow_motion_worthy", "jump", "splash", "speed", "wake"} & set(m["tags"]))


def shot_from(m, want):
    """A window of `want` seconds on screen inside the moment, around its peak. Slow motion when it is worth it."""
    speed = 0.5 if slow_ok(m) else 1.0
    src_len = round(min(want * speed, m["end"] - m["start"]), 2)
    start = max(m["start"], min(m["peak"] - src_len * 0.55, m["end"] - src_len))
    landscape = (m["w"] or 0) > (m["h"] or 1)
    return {"file_id": m["file_id"], "name": m["name"], "start": round(start, 2), "len": src_len, "speed": speed, "peak": m["peak"],
            "x": m["x"] if landscape else 0.5, "x2": m["x2"] if landscape else 0.5,
            "what": m["what"], "tags": m["tags"], "score": m["score"], "hook": m["hook"],
            "audio": "own" if m["camera"] == "phone" and (sum(m["loud"]) / max(1, len(m["loud"]))) > 18 else "sea"}


def theme_of(m):
    best = max(THEMES, key=lambda t: len(THEMES[t] & set(m["tags"])))
    return best if THEMES[best] & set(m["tags"]) else "ride"


def pick(fmt, cand, recent_files):
    """The moments for one video of this format, or None. Never two shots of the same file in one video unless the
    file is long enough to look different (drone flights): then their windows are at least 20 s apart."""
    spec = FORMATS[fmt]
    ok = [m for m in cand if m["name"] not in recent_files]
    if fmt in ("highlight", "question", "loop"):
        need = {"highlight": 7, "question": 6, "loop": 6}[fmt]
        for m in ok:
            if m["score"] >= need and (fmt != "loop" or "loop_worthy" in m["tags"] or "calm" in m["tags"] or "aerial" in m["tags"]):
                if m["end"] - m["start"] >= spec["len"][0] * (0.5 if slow_ok(m) else 1):
                    return [m]
        return None
    n = spec["shots"]
    if fmt == "bestof":
        chosen, files = [], set()
        for m in ok:
            if m["name"] not in files and m["score"] >= 7:
                chosen.append(m); files.add(m["name"])
            if len(chosen) == n:
                return chosen
        return None
    for lead in ok:
        th = theme_of(lead)
        group = [lead]
        for m in ok:
            if m is lead or theme_of(m) != th:
                continue
            if any(m["name"] == g["name"] and abs(m["start"] - g["start"]) < 20 for g in group):
                continue
            group.append(m)
            if len(group) == n:
                group.sort(key=lambda g: -g["hook"])     # the strongest opening first
                return group
    return None


FACTS = None


def facts():
    global FACTS
    if FACTS is None:
        b = read_json(SITE / "ig-auto" / "brand.json", {})
        FACTS = {"facts": b.get("facts"), "voice": b.get("voice")}
    return FACTS


def trip_of(shots):
    tags = set(t for s in shots for t in s["tags"])
    if tags & {"swim", "jump", "paddle"}:
        return "Day Trip (swim and paddle stop)"
    if tags & {"sunset", "golden_light"}:
        return "Sunset Trip"
    return "either trip"


def text_prompt(v, recent):
    fmt_help = {
        "highlight": "One strong moment. The hook names it plainly.",
        "montage": "Three moments of one theme. The hook names the theme.",
        "pov": "The hook starts with 'POV:' and puts the viewer on the boat (e.g. 'POV: your boat, your cove').",
        "list": "Three moments, each with its own on-screen label of 2 to 4 words (in 'labels'), e.g. a numbered list "
                "like '1. Cliffs from the water'. The hook is the list title, e.g. '3 things on our Day Trip'.",
        "question": "The hook is a short question to the viewer that the clip answers or teases ('Would you jump?').",
        "loop": "A calm looping clip. The hook is quiet and short.",
        "bestof": "Five quick moments: the best of a summer on our boat. The hook says so plainly.",
    }[v["format"]]
    shots = [{"what": s["what"], "tags": s["tags"]} for s in v["shots"]]
    return f"""You write the words for one short vertical video of Chifbay, a small family business running private boat
trips from Funchal, Madeira. Real footage from our trips. Brand facts and voice (never contradict them):
{json.dumps(facts(), ensure_ascii=False)}

Video format: {v['format']}. {fmt_help}
What is on screen, shot by shot: {json.dumps(shots, ensure_ascii=False)}
Which trip this footage fits: {trip_of(v['shots'])}.
Call to action to use at the end of the Instagram caption (exactly this sentence): "{v['cta']}"
Hooks and first lines used recently (do NOT reuse or echo them): {json.dumps(recent, ensure_ascii=False)}

Answer with JSON only:
{{
 "hook": "on-screen hook, 6 words at most, no hashtag, no emoji",
 "labels": ["only for the list format: one label per shot, 2 to 4 words"],
 "thumb": "thumbnail title, 2 to 4 words, can differ from the hook",
 "ig": "Instagram caption: first line a teaser that names the place and service (contains 'Funchal, Madeira' or 'Madeira' and 'boat'), then 2 short paragraphs with true facts that fit this clip, then the call to action as the last line. 350 to 900 characters. 0 to 2 emoji.",
 "hashtags": ["4 or 5 hashtags, always #madeira and #funchal, others specific to the clip"],
 "fb": "Facebook text, 200 to 500 characters, warm and plain, no link (the booking link is added after it)",
 "threads": "Threads text, 60 to 220 characters, conversational, no hashtags",
 "yt_title": "YouTube Shorts title, 40 to 70 characters, catchy and true, ends with ' #Shorts'",
 "yt_description": "YouTube description: a hook line, 2 to 3 lines on what you see and the trip, then 'Book: https://chifbay.com/?utm_source=youtube&utm_medium=shorts', then 3 hashtags. 300 to 700 characters.",
 "yt_tags": ["10 to 15 search tags: madeira boat trip, funchal, things to do in madeira, ..."],
 "tiktok": "TikTok caption, 80 to 150 characters plus 4 or 5 hashtags at the end",
 "alt": "plain description of the video for blind users, one sentence"
}}
Hard rules: never a price, a discount or a number of guests above 5; never 'guaranteed', 'cheapest', 'unlimited', a fixed
sunset time, 'full day'; no long dashes; never say dolphins unless the shots show them; swimming only on the Day Trip;
the drone flies only when the weather allows; write like a small local crew, not an ad agency."""


BANNED = ["guarantee", "cheapest", "unlimited", "full day", "full-day", "no filter", "nobody else on board", "18:30", "€", "eur ",
          "per person", "discount", "6 guests", "7 guests", "8 guests"]


def text_problems(v, t):
    p = []
    req = ["hook", "thumb", "ig", "hashtags", "fb", "threads", "yt_title", "yt_description", "yt_tags", "tiktok", "alt"]
    p += [f"missing {k}" for k in req if not t.get(k)]
    if p:
        return p
    if len(t["hook"].split()) > 6:
        p.append("hook over 6 words")
    if v["format"] == "list" and (len(t.get("labels") or []) != len(v["shots"]) or any(len(l.split()) > 5 for l in t["labels"])):
        p.append("list needs one label of 2 to 4 words per shot")
    if v["format"] == "pov" and not t["hook"].lower().startswith("pov"):
        p.append("POV hook must start with 'POV:'")
    alltext = " ".join(str(x) for x in t.values()).lower()
    p += [f"says '{b}'" for b in BANNED if b in alltext]
    if "—" in alltext or "–" in alltext:
        p.append("long dash")
    if "dolphin" in alltext and not any("dolphins" in s["tags"] for s in v["shots"]):
        p.append("mentions dolphins that are not in the shots")
    if "madeira" not in t["ig"][:220].lower():
        p.append("Instagram first lines must name Madeira")
    if not t["ig"].strip().endswith(v["cta"]):
        p.append(f"Instagram caption must end with: {v['cta']}")
    if not 300 <= len(t["ig"]) <= 1100:
        p.append(f"Instagram caption {len(t['ig'])} characters")
    if not (3 <= len(t["hashtags"]) <= 5 and "#madeira" in [h.lower() for h in t["hashtags"]]):
        p.append("hashtags: 3 to 5, with #madeira")
    if len(t["yt_title"]) > 95 or "#shorts" not in t["yt_title"].lower():
        p.append("YouTube title too long or without #Shorts")
    if "https://chifbay.com" not in t["yt_description"]:
        p.append("YouTube description without the chifbay.com link")
    if len(t["threads"]) > 480:
        p.append("Threads text too long")
    return p


def write_texts(v, recent):
    prompt = text_prompt(v, recent)
    for attempt in range(3):
        t, model = gemini([{"text": prompt}], temperature=0.8)
        probs = text_problems(v, t) if isinstance(t, dict) else ["not an object"]
        if not probs:
            t["hashtags"] = [h if h.startswith("#") else "#" + h for h in t["hashtags"]]
            t["model"] = model
            return t
        log(f"  texts refused ({'; '.join(probs)}), retry {attempt + 1}")
        prompt += f"\n\nYour last answer broke these rules, fix them: {'; '.join(probs)}"
    raise RuntimeError(f"no valid texts for {v['id']}: {'; '.join(probs)}")


MOODS = {"swim": "jump", "coast": "cliffs", "ride": "aerial", "sunset": "sunset", "people": "fun"}


def main():
    args = sys.argv[1:]
    dry = "--dry" in args
    plan = read_json(PLAN, {"videos": []})
    moments = read_json(MOMENTS, {"files": {}})
    waiting = [v for v in plan["videos"] if not v.get("posted") and v.get("status") not in ("retired", "failed")]
    want = int(args[args.index("--add") + 1]) if "--add" in args else max(0, WAITING_TARGET - len(waiting))
    if not want:
        log(f"{len(waiting)} videos already waiting: nothing to plan")
        return
    used = used_windows(plan)
    cand = pool(moments, used)
    log(f"{len(cand)} unused moments scored 6+ in {len(moments.get('files', {}))} files; planning {want}")
    n = len(plan["videos"])
    recent_files = [s["name"] for v in plan["videos"][-3:] for s in v.get("shots", [])]
    recent_text = [x for v in plan["videos"][-20:] for x in (v.get("texts", {}).get("hook"), v.get("texts", {}).get("ig", "")[:80]) if x]
    rot = len(plan["videos"]) % len(ROTATION)
    added, misses = 0, 0
    while added < want and misses < len(ROTATION):
        fmt = ROTATION[(rot + added + misses) % len(ROTATION)]
        ms = pick(fmt, cand, set(recent_files[-6:]))
        if not ms:
            misses += 1
            continue
        spec = FORMATS[fmt]
        per = (spec["len"][0] + spec["len"][1]) / 2
        if fmt in ("highlight", "question", "loop"):
            per = min(spec["len"][1], max(spec["len"][0], (ms[0]["end"] - ms[0]["start"]) / (0.5 if slow_ok(ms[0]) else 1) * 0.85))
        shots = [shot_from(m, per) for m in ms]
        vid = f"s{n + added + 1:03d}"
        v = {"id": vid, "format": fmt, "status": "draft", "created": time.strftime("%Y-%m-%d"), "shots": shots,
             "music": MOODS[theme_of(ms[0])], "audio": "own" if all(s["audio"] == "own" for s in shots) else "sea",
             "cta": CTAS[(n + added) % len(CTAS)], "light": ms[0]["light"], "recorded": ms[0]["created"] or None}
        log(f"{vid} {fmt}: " + " | ".join(f"{s['name']}@{s['start']}+{s['len']}x{s['speed']} {s['what'][:40]}" for s in shots))
        if not dry:
            try:
                v["texts"] = write_texts(v, recent_text)
            except Exception as e:
                log(f"  skipped: {e}")
                misses += 1
                continue
            log(f"  hook: {v['texts']['hook']}")
            recent_text += [v["texts"]["hook"], v["texts"]["ig"][:80]]
            plan["videos"].append(v)
            write_json(PLAN, plan)
        for m in ms:
            cand.remove(m)
            used.setdefault(m["name"], []).append((m["start"], m["end"]))
        recent_files += [s["name"] for s in shots]
        added += 1
        misses = 0
    left = len(pool(moments, used))
    log(f"added {added}; {left} unused moments left (about {left // 2} more videos)")
    if added < want:
        log("not enough fresh footage for every slot: drop new trip videos in the Drive PUBLISH folder")


if __name__ == "__main__":
    main()
