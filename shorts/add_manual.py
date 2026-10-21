#!/usr/bin/env python3
"""Add moments picked by eye (from drive-scan contact sheets) to shorts/moments.json.

    python3 shorts/add_manual.py picks.json

picks.json = {"<drive file id>": {"name", "path", "w", "h", "fps", "dur", "camera", "light", "summary",
              "moments": [{"start", "end", "peak", "score", "hook", "what", "tags", "x", "x2"}]}}
Used when Gemini's free calls are spent for the day. A file already scanned by Gemini keeps its own moments and gets
these added (no overlap). plan.py treats them like any other moment.
"""
import json, sys, time
from find import ISSUES, TAGS
from lib import MOMENTS, read_json, write_json


def main():
    picks = json.load(open(sys.argv[1]))
    db = read_json(MOMENTS, {"version": 1, "files": {}})
    for fid, p in picks.items():
        rec = db["files"].get(fid) or {k: p.get(k) for k in ("name", "path", "w", "h", "fps", "dur", "camera", "light", "summary")}
        rec.setdefault("version", 1)
        rec["boat"] = True
        rec.pop("error", None)
        rec.setdefault("model", "claude (contact sheet)")
        have = rec.get("moments", [])
        for m in p["moments"]:
            if any(not (m["end"] <= h["start"] or m["start"] >= h["end"]) for h in have):
                continue
            have.append({"start": m["start"], "end": m["end"], "peak": m.get("peak", (m["start"] + m["end"]) / 2),
                         "score": m["score"], "hook": m["hook"], "what": m["what"],
                         "tags": [t for t in m["tags"] if t in TAGS], "x": m.get("x", 0.5), "x2": m.get("x2", m.get("x", 0.5)),
                         "people": m.get("people", "far"), "issues": [i for i in m.get("issues", []) if i in ISSUES],
                         "by": "claude (contact sheet)"})
        rec["moments"] = sorted(have, key=lambda m: m["start"])
        rec["scanned_at"] = rec.get("scanned_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        db["files"][fid] = rec
        print(f"{rec['name']}: {len(rec['moments'])} moments")
    write_json(MOMENTS, db)


if __name__ == "__main__":
    main()
