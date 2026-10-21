"""Keep the subject in the middle of a 9:16 crop taken from landscape footage (Theo, 21 Oct 2026: "some videos are
not centered correctly": the crop positions were guessed from small contact sheets and the boat or the guests were cut).

    path = track(shot, src)   ->  [(t, cx), ...]  or None
        t  = seconds from the start of the shot (source time, before any slow motion)
        cx = horizontal centre of the subject, 0..1 of the source width

How: 4 frames a second of the shot are read from the Drive, a small object detector (YOLO, free, runs on the CPU)
finds the boat and the people; the target is the main boat together with the people on or next to it, or the people
alone when there is no boat. Missing frames are filled in, the path is smoothed and its speed limited, so the crop
moves like a calm camera operator. No detection at all (cliffs, open sea) = None: the planned x / x2 stays.
"""
import pathlib, subprocess, tempfile
import numpy as np
from lib import drive_input, log

FPS = 4
MAX_PAN = 0.18          # at most this share of the frame width per second: calm, not jumpy
_model = None


def _detector():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO("yolo11n.pt")
    return _model


def _target(boxes):
    """boxes = [(cls, conf, x0, y0, x1, y1)] in 0..1. Main boat + the people on or next to it, else the people."""
    boats = [b for b in boxes if b[0] == 8]
    people = [b for b in boxes if b[0] == 0]
    area = lambda b: (b[4] - b[2]) * (b[5] - b[3])
    if boats:
        main = max(boats, key=area)
        mx0, mx1 = main[2], main[4]
        pad = (mx1 - mx0) * 0.35
        near = [p for p in people if p[4] >= mx0 - pad and p[2] <= mx1 + pad]
        xs0 = [main[2]] + [p[2] for p in near]
        xs1 = [main[4]] + [p[4] for p in near]
        return (min(xs0) + max(xs1)) / 2
    if people:
        # the biggest group: people whose boxes are within one crop width (0.32 of the frame) of the largest one
        big = max(people, key=area)
        c = (big[2] + big[4]) / 2
        grp = [p for p in people if abs((p[2] + p[4]) / 2 - c) < 0.32]
        return (min(p[2] for p in grp) + max(p[4] for p in grp)) / 2
    return None


def _smooth(ts, xs):
    xs = np.array(xs, dtype=float)
    k = 3
    if len(xs) >= k:
        pad = np.pad(xs, (k // 2, k // 2), mode="edge")
        xs = np.convolve(pad, np.ones(k) / k, mode="valid")
    out = [xs[0]]
    for i in range(1, len(xs)):
        dt = ts[i] - ts[i - 1]
        step = max(-MAX_PAN * dt, min(MAX_PAN * dt, xs[i] - out[-1]))
        out.append(out[-1] + step)
    return [round(float(x), 4) for x in out]


def track(s, src):
    """The subject path of one shot, or None when nothing was found."""
    if not src.get("w") or src["w"] / max(1, src["h"]) <= 9 / 16 + 0.01:
        return None                      # a vertical source needs no crop
    with tempfile.TemporaryDirectory() as td:
        pat = str(pathlib.Path(td) / "f%03d.jpg")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(s["start"]), "-t", str(s["len"]),
                        *drive_input(s["file_id"]), "-vf", f"fps={FPS},scale=640:-2", "-q:v", "4", pat], check=False)
        frames = sorted(pathlib.Path(td).glob("f*.jpg"))
        if not frames:
            return None
        try:
            res = _detector()([str(f) for f in frames], classes=[0, 8], conf=0.25, verbose=False, imgsz=640)
        except Exception as e:  # the detector must never stop a build: the planned crop stays
            log(f"    reframe: detector failed ({e})")
            return None
        ts, xs = [], []
        for i, r in enumerate(res):
            w, h = r.orig_shape[1], r.orig_shape[0]
            boxes = [(int(c), float(p), x0 / w, y0 / h, x1 / w, y1 / h)
                     for (x0, y0, x1, y1), c, p in zip(r.boxes.xyxy.tolist(), r.boxes.cls.tolist(), r.boxes.conf.tolist())]
            ts.append(i / FPS)
            xs.append(_target(boxes))
    found = [x for x in xs if x is not None]
    if len(found) < max(2, len(xs) // 3):
        return None
    # fill the gaps with the nearest known value, then smooth
    last = found[0]
    filled = []
    for x in xs:
        last = x if x is not None else last
        filled.append(last)
    return list(zip(ts, _smooth(ts, filled)))


def crop_expr(path, w, cw, dur):
    """ffmpeg expression of t for the crop's left edge, linear between the tracked points."""
    lo = lambda c: max(0.0, min(w - cw, c * w - cw / 2))
    pts = [(t, lo(c)) for t, c in path if t <= dur + 0.01]
    if len(pts) == 1:
        return f"{pts[0][1]:.1f}"
    expr = f"{pts[-1][1]:.1f}"
    for (t0, a), (t1, b) in reversed(list(zip(pts, pts[1:]))):
        seg = f"{a:.1f}+({b - a:.1f})*(t-{t0:.3f})/{max(0.001, t1 - t0):.3f}"
        expr = f"if(lt(t,{t1:.3f}),{seg},{expr})"
    return expr
