#!/usr/bin/env python3
"""Cut, grade, title and check the planned short videos (runs on GitHub, workflow shorts-make.yml).

    python3 shorts/render.py           every video in plan.json that is planned but not built yet
    python3 shorts/render.py s004 s007 (re)build only these

Per video it makes, and stores in the chifbay-media Worker (KV, expires on its own):
    <id>-<v>.mp4        1080x1920, 30 fps, music + sea (or the clip's own voices), -14 LUFS
    <id>-<v>-p.mp4      540x960 preview for the review page
    <id>-<v>-cover.jpg  clean cover, no words (Instagram grid rule, Theo 3 Oct 2026: the grid is the covers)
    <id>-<v>-thumb.jpg  designed thumbnail with a short title (YouTube, the review page)
The house rules come from stores/chifbay/reels/make.py (audit of 2 Oct 2026): one short hook in the brand serif,
white with a soft shadow, nothing over a face, the Atlantic grade per kind of light, slow motion only from 60 fps,
sound always present and at Instagram's loudness. A video whose checks fail is never offered for review.
"""
import asyncio, hashlib, json, os, pathlib, re, subprocess, sys, tempfile, time, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import reframe
from lib import (FONTS, HERE, PLAN, SITE, QuotaGone, drive_input, gemini, gemini_delete, gemini_key, gemini_keys, gemini_upload,
                 key_spent, log, media_put, read_json, run, write_json)

W, H, FPS = 1080, 1920, 30
SERIF = FONTS / "DMSerifDisplay-Italic.ttf"
SANS = FONTS / "Inter-SemiBold.ttf"
LOOK = read_json(SITE / "ig-auto" / "look.json", {})
GOLD = (201, 164, 92)
SEA = HERE / "assets" / "sea.m4a"
TEXT_X0, TEXT_X1 = 90, 990
DURATION = {"fast": (8.0, 16.5), "story": (11.0, 19.5), "highlight": (4.5, 9.5), "montage": (7.5, 13.5), "pov": (6.0, 10.5), "list": (8.0, 12.5),
            "question": (4.5, 8.5), "loop": (3.5, 7.0), "bestof": (8.5, 13.5)}
MOODS = {
    "day": ("Sunny Balearic chill house, warm clean electric guitar, light percussion, a summer day on a boat, uplifting and relaxed, no vocals", 116),
    "jump": ("Upbeat tropical house, punchy beat, bright plucks, playful summer energy, no vocals", 120),
    "aerial": ("Airy cinematic chill electronic, wide warm pads, gentle steady beat, flying over the sea, no vocals", 104),
    "sunset": ("Warm deep house at golden hour, mellow electric piano, soft groove, sunset on the sea, no vocals", 112),
    "fun": ("Light playful summer beat, ukulele, hand claps, sunny and silly, no vocals", 118),
    "cliffs": ("Cinematic ambient with a slow building beat, majestic strings and pads, ocean cliffs, no vocals", 96),
}


# ---- light and grade (same presets as the Reels and the photos: ig-auto/look.json) ------------

def lab_stats(raw):
    px = np.frombuffer(raw, np.uint8).reshape(-1, 3) / 255.0
    lin = np.where(px > 0.04045, ((px + 0.055) / 1.055) ** 2.4, px / 12.92)
    xyz = lin @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[:, 1] - 16
    A, B = 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])
    hi = L > 70
    return {"L50": float(np.median(L)), "chroma": float(np.hypot(A, B).mean()), "hiB": float(B[hi].mean()) if hi.any() else 0.0}


def measure(s):
    """Light and colour of a shot from 2 small frames a second: the kind of light, and per-channel mean and spread."""
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(s["start"]), "-t", str(s["len"]), *drive_input(s["file_id"]),
                          "-vf", "fps=2,scale=96:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    if not raw:
        raise RuntimeError(f"could not read {s['name']} at {s['start']} s from the Drive")
    st = lab_stats(raw)
    kind = "golden" if st["hiB"] > 18 else "overcast" if st["chroma"] < 9 else "daylight"
    px = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.float32)
    keep = (px.max(axis=1) < 250) & (px.min(axis=1) > 5)          # leave clipped highlights and pure black out
    px = px[keep] if keep.sum() > 100 else px
    return {"kind": kind, "mean": px.mean(axis=0).tolist(), "std": px.std(axis=0).tolist(), "L50": st["L50"]}


def match_filter(st, target, strength=0.8):
    """Theo, 22 Oct 2026: "the colors could be better, more stable, too much change between the videos". Every shot of a
    video is pulled toward the same colour (per channel mean and spread, the shots' average): drone and phone, sun and
    shade then look like one film. Limited so a shot is corrected, never repainted."""
    out = []
    for c, ch in enumerate("rgb"):
        m, sd = st["mean"][c], max(1.0, st["std"][c])
        tm, tsd = target["mean"][c], target["std"][c]
        gain = max(0.85, min(1.2, 1 + strength * (tsd / sd - 1)))
        shift = max(-25.0, min(25.0, strength * (tm - m)))
        out.append(f"{ch}='clip((val-{m:.1f})*{gain:.3f}+{m + shift:.1f},0,255)'")
    return "lutrgb=" + ":".join(out)


def video_target(stats):
    """The colour every shot of one video is matched to: the average of its shots."""
    return {"mean": np.mean([x["mean"] for x in stats], axis=0).tolist(), "std": np.mean([x["std"] for x in stats], axis=0).tolist()}


# Theo, 21 Oct 2026, on the first POV stories: "better colors! more natural and good weather day type". The film look of
# the photos (look.json: lifted blacks, blue shadows, warm highlights) is NOT used for the videos any more: true whites,
# clean blacks, a little life in the sea and the sky (vibrance boosts dull colours, leaves skin alone), nothing else.
NATURAL = {
    "daylight": "vibrance=intensity=0.12,eq=contrast=1.04:saturation=1.05",
    "golden": "vibrance=intensity=0.06,eq=contrast=1.03",
    "overcast": "vibrance=intensity=0.15,eq=contrast=1.06:saturation=1.08",
}


def grade(kind, match=None):
    """deflicker steadies the camera's own exposure changes inside a shot, the match evens the shots out, then one
    natural grade for the whole video."""
    return ",".join(["deflicker=size=7:mode=pm"] + ([match] if match else []) + [NATURAL[kind]])


def crop_filter(s, w, h, dur, path=None):
    """9:16 out of a landscape source. With a tracked path (reframe.py) the crop follows the boat and the people;
    without one it pans from the planned x to x2."""
    if w / h <= 9 / 16 + 0.01:
        return [f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"], W / w
    if s.get("ch"):
        h = int(h * s["ch"]) // 2 * 2       # keep the top share only (the Insta360 app puts its watermark at the bottom)
    cw = int(h * 9 / 16) // 2 * 2
    if path:
        return [f"crop={cw}:{h}:'{reframe.crop_expr(path, w, cw, dur)}':0", f"scale={W}:{H}:flags=lanczos"], W / cw
    lo = lambda c: max(0, min(w - cw, c * w - cw / 2))
    a, b = lo(s.get("x", 0.5)), lo(s.get("x2", s.get("x", 0.5)))
    xexpr = f"{a:.1f}+({b - a:.1f})*t/{dur:.3f}" if abs(b - a) > 1 else f"{a:.1f}"
    return [f"crop={cw}:{h}:'{xexpr}':0", f"scale={W}:{H}:flags=lanczos"], W / cw


def render_shot(s, src, out, tmp, extra=0.0, own=False, look=None):
    w, h, fps = src["w"], src["h"], src["fps"]
    speed = s.get("speed", 1.0)
    if speed != 1.0 and fps < 50:
        speed = 1.0                       # never slow a 30 fps source: it stutters
    src_len = s["len"] + extra * speed
    dur = src_len / speed
    st = look["stats"] if look else measure(s)
    kind = look["kind"] if look else st["kind"]
    path = None if s.get("lock_crop") else reframe.track({**s, "len": src_len}, src)
    vf, up = crop_filter(s, w, h, src_len, path)
    if up > 1.3:
        vf.append("unsharp=5:5:0.4")
    vf.append(grade(kind, match_filter(st, look["target"]) if look else None))
    if speed != 1.0:
        vf.append(f"setpts=PTS/{speed}")
    vf += [f"fps={FPS}", "format=yuv420p", "setsar=1"]
    args = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(s["start"]), "-t", f"{src_len:.3f}", *drive_input(s["file_id"]),
            "-vf", ",".join(vf), "-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "16"]
    if own:
        args += ["-af", f"atempo={speed}" if speed != 1.0 else "anull", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"]
    else:
        args += ["-an"]
    run(args + [str(out)])
    return {"grade": kind, "matched": bool(look), "seconds": round(dur, 2), "speed": speed,
            "tracked": bool(path), "path": [round(c, 3) for _, c in path][::4] if path else None}


# ---- words -----------------------------------------------------------------------------------

def balanced(text, width, limit):
    if width(text) <= limit:
        return [text]
    words, best = text.split(), None
    for cut in range(1, len(words)):
        parts = [" ".join(words[:cut]), " ".join(words[cut:])]
        ws = [width(x) for x in parts]
        if max(ws) <= limit and (best is None or max(ws) - min(ws) < best[0]):
            best = (max(ws) - min(ws), parts)
    if not best:
        raise RuntimeError(f"text does not fit on two lines: {text!r}")
    return best[1]


def serif_png(text, path, size=52, top=300):
    """White DM Serif Display italic with a soft shadow, no band (Theo, 3 Oct 2026)."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    font = ImageFont.truetype(str(SERIF), size)
    layer, shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)), Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(layer), ImageDraw.Draw(shadow)
    lines = balanced(text, lambda t: d.textlength(t, font=font), TEXT_X1 - TEXT_X0)
    step = int(size * 1.2)
    for i, l in enumerate(lines):
        tw = d.textlength(l, font=font)
        x, y = W / 2 - tw / 2, top + i * step
        # a wider soft halo, so a white line still reads over white clouds or bright water (no band: Theo, 3 Oct)
        ds.text((x, y + 2), l, font=font, fill=(0, 0, 0, 200), stroke_width=max(3, size // 14), stroke_fill=(0, 0, 0, 150))
        d.text((x, y), l, font=font, fill=(255, 255, 255, 255))
    soft = shadow.filter(ImageFilter.GaussianBlur(9))
    img.alpha_composite(soft)
    img.alpha_composite(soft)
    img.alpha_composite(layer)
    img.save(path)
    return lines


def thumbnail(frame, title, path):
    """Designed thumbnail: the frame, a soft dark fall at the bottom, the title in the serif, a small gold line."""
    im = Image.open(frame).convert("RGB").resize((W, H), Image.LANCZOS)
    grad = Image.new("L", (1, H))
    for y in range(H):
        t = max(0.0, (y - H * 0.45) / (H * 0.55))
        grad.putpixel((0, y), int(215 * t ** 1.2))
    dark = Image.new("RGB", (W, H), (5, 15, 24))
    im = Image.composite(dark, im, grad.resize((W, H)))
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(str(SERIF), 118)
    lines = balanced(title, lambda t: d.textlength(t, font=font), 900)
    y = 1430 - (len(lines) - 1) * 130
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(shadow)
    for i, l in enumerate(lines):
        tw = d.textlength(l, font=font)
        ds.text((W / 2 - tw / 2, y + i * 130 + 3), l, font=font, fill=(0, 0, 0, 170))
    im = im.convert("RGBA")
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        tw = d.textlength(l, font=font)
        d.text((W / 2 - tw / 2, y + i * 130), l, font=font, fill=(255, 255, 255, 255))
    label = "CHIFBAY  ·  FUNCHAL, MADEIRA"
    sans = ImageFont.truetype(str(SANS), 30)
    spaced = " ".join(label)
    lw = d.textlength(spaced, font=sans)
    ly = y + len(lines) * 130 + 40
    d.line([(W / 2 - 60, ly - 18), (W / 2 + 60, ly - 18)], fill=GOLD, width=3)
    d.text((W / 2 - lw / 2, ly), spaced, font=sans, fill=GOLD)
    im.convert("RGB").save(path, quality=88, optimize=True)


# ---- music (Lyria RealTime, free with the Gemini key) --------------------------------------------

async def _lyria(path, prompt, bpm, seconds):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=gemini_key(), http_options={"api_version": "v1alpha"})
    pcm, sr = bytearray(), 48000
    async with client.aio.live.music.connect(model="models/lyria-realtime-exp") as s:
        await s.set_weighted_prompts(prompts=[types.WeightedPrompt(text=prompt, weight=1.0)])
        await s.set_music_generation_config(config=types.LiveMusicGenerationConfig(
            bpm=bpm, density=0.55, brightness=0.6, guidance=4.0, temperature=1.0))
        await s.play()
        async for m in s.receive():
            if m.server_content and m.server_content.audio_chunks:
                for ch in m.server_content.audio_chunks:
                    pcm += ch.data
            if len(pcm) / (sr * 4) >= seconds:
                break
    if len(pcm) < sr * 4 * 8:
        raise RuntimeError("Lyria sent less than 8 s of music")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(bytes(pcm))


def beat_start(path, bpm, skip=4.0):
    """Where to start the music so a beat falls at 0: cuts of whole beats then land on the beat (fast edits)."""
    with wave.open(str(path)) as w:
        sr, n = w.getframerate(), w.getnframes()
        a = np.frombuffer(w.readframes(n), np.int16).astype(np.float32).reshape(-1, w.getnchannels()).mean(axis=1)
    hop = 512
    frames = len(a) // hop
    e = np.log1p(np.sqrt((a[:frames * hop].reshape(frames, hop) ** 2).mean(axis=1)))
    onset = np.maximum(0, np.diff(e, prepend=e[0]))
    period = 60.0 / bpm
    best, best_ph = -1, 0.0
    for ph in np.arange(0, period, 0.01):
        idx = ((skip + ph + np.arange(24) * period) * sr / hop).astype(int)
        idx = idx[idx < len(onset)]
        sc = onset[idx].sum()
        if sc > best:
            best, best_ph = sc, ph
    return round(skip + best_ph, 3)


def music(mood, path):
    prompt, bpm = MOODS.get(mood, MOODS["day"])
    for attempt in range(3):
        try:
            asyncio.run(asyncio.wait_for(_lyria(path, prompt, bpm, 30), 180))
            return
        except Exception as e:
            log(f"  music try {attempt + 1}: {e}")
            time.sleep(20)
    raise RuntimeError("no music from Lyria")


# ---- checks ----------------------------------------------------------------------------------

def loudness(path):
    r = subprocess.run(["ffmpeg", "-nostdin", "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def checks(v, master, total):
    p = []
    info = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", str(master)]))
    vs = [s for s in info["streams"] if s["codec_type"] == "video"]
    if not vs or (vs[0]["width"], vs[0]["height"]) != (W, H):
        p.append("not 1080x1920")
    if not any(s["codec_type"] == "audio" for s in info["streams"]):
        p.append("no sound track")
    else:
        lufs = loudness(master)
        if lufs is None or not -16.5 <= lufs <= -12:
            p.append(f"sound at {lufs} LUFS (wanted about -14)")
    lo, hi = DURATION[v["format"]]
    if not lo <= total <= hi:
        p.append(f"{total:.1f} s is outside {lo} to {hi} s for {v['format']}")
    r = subprocess.run(["ffmpeg", "-nostdin", "-i", str(master), "-vf", "blackdetect=d=0.4:pix_th=0.08,freezedetect=n=0.001:d=1.5",
                        "-f", "null", "-"], capture_output=True, text=True)
    if r.returncode:
        p.append("does not decode to the end")
    if "black_start" in r.stderr:
        p.append("black frames")
    if "freeze_start" in r.stderr and v["format"] != "loop":
        p.append("a frozen picture")
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(master), "-vf", "fps=10,scale=90:160", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 160, 90, 3).astype(int)
    if (((a[..., 1] > 150) & (a[..., 0] < 100) & (a[..., 2] < 120)).mean(axis=(1, 2)) > 0.02).any():
        p.append("green decoding holes")
    if master.stat().st_size > 24 * 1024 * 1024:
        p.append("file over 24 MB")
    return p


# ---- one video ---------------------------------------------------------------------------------

def build(v, moments, tmp):
    t = v["texts"]
    parts, log_shots = [], []
    loop = v["format"] == "loop"
    xf = 0.6
    stats = [measure(s) for s in v["shots"]]
    target = video_target(stats)
    kinds = [x["kind"] for x in stats]
    kind = max(set(kinds), key=kinds.count)          # one grade for the whole video
    for i, s in enumerate(v["shots"]):
        src = moments["files"][s["file_id"]]
        part = tmp / f"p{i}.mp4"
        info = render_shot(s, src, part, tmp, extra=xf if loop else 0.0, own=v.get("audio") == "own" and not loop,
                           look={"stats": stats[i], "target": target, "kind": kind})
        parts.append(part)
        log_shots.append({"name": s["name"], "in": s["start"], "out": round(s["start"] + s["len"], 2), **info, "what": s["what"]})
    joined = tmp / "joined.mp4"
    has_own = v.get("audio") == "own"
    if loop:
        L = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(parts[0])])) - xf
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(parts[0]), "-filter_complex",
             f"[0:v]split[a][b];[a]trim={xf}:{L + xf},setpts=PTS-STARTPTS[x];[b]trim=0:{xf},setpts=PTS-STARTPTS[y];"
             f"[x][y]xfade=transition=fade:duration={xf}:offset={L - xf},format=yuv420p[v]",
             "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "16", str(joined)])
        has_own = False
    else:
        lst = tmp / "list.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in parts))
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(joined)])
    total = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(joined)]))

    # words: the hook (or the list title) for the first 2.8 s; list labels each on their own shot.
    # A POV story (Theo, 21 Oct 2026: "POV / story with text") has one line per shot instead, the first one "POV: ...".
    inputs, fc, last, n = ["-i", str(joined)], [], "0:v", 1
    if v["format"] == "story":
        cursor = 0.0
        for i, (line, sh) in enumerate(zip(t.get("labels", []), log_shots)):
            a, b = cursor, cursor + sh["seconds"]
            lp = tmp / f"l{i}.png"
            serif_png(line, lp, 58, 330)
            inputs += ["-loop", "1", "-i", str(lp)]
            fade_in = f",fade=t=in:st={a + 0.05:.2f}:d=0.25:alpha=1" if i else ""
            fc += [f"[{n}:v]format=rgba{fade_in}[l{i}]",
                   f"[{last}][l{i}]overlay=0:0:shortest=1:enable='between(t,{a:.2f},{(b if i < len(log_shots) - 1 else total) - 0.05:.2f})'[w{i}]"]
            last, n, cursor = f"w{i}", n + 1, b
    hook_end = min(2.8, total - 0.6) if v["format"] != "list" else min(2.0, total - 0.6)
    if v["format"] != "story":
        hp = tmp / "hook.png"
        serif_png(t["hook"], hp, 52, 300)
        inputs += ["-loop", "1", "-i", str(hp)]
        fc += [f"[{n}:v]format=rgba,fade=t=out:st={hook_end - 0.3}:d=0.3:alpha=1[h]", f"[{last}][h]overlay=0:0:shortest=1:enable='lte(t,{hook_end})'[v1]"]
        last, n = "v1", n + 1
    if v["format"] == "list":
        cursor = 0.0
        for i, (lab, sh) in enumerate(zip(t.get("labels", []), log_shots)):
            a, b = max(cursor, hook_end + 0.1 if i == 0 else cursor), cursor + sh["seconds"]
            lp = tmp / f"l{i}.png"
            serif_png(lab, lp, 50, 380)
            inputs += ["-loop", "1", "-i", str(lp)]
            fc += [f"[{n}:v]format=rgba[l{i}]", f"[{last}][l{i}]overlay=0:0:shortest=1:enable='between(t,{a:.2f},{b - 0.05:.2f})'[w{i}]"]
            last, n, cursor = f"w{i}", n + 1, b
    # sound: music made for this video over the sea (or over the clip's own voices), brought to -14 LUFS
    mus = tmp / "music.wav"
    music(v.get("music", "day"), mus)
    if has_own:
        fc.append("[0:a]volume=1.0[base]")
        mvol = 0.32
    else:
        inputs += ["-ss", str(int(hashlib.sha1(v["id"].encode()).hexdigest(), 16) % 40), "-i", str(SEA)]
        fc.append(f"[{n}:a]volume=0.5,atrim=0:{total}[base]")
        n += 1
        mvol = 0.9
    music_from = beat_start(mus, MOODS.get(v.get("music", "day"), MOODS["day"])[1]) if v.get("beat_cuts") else 4
    inputs += ["-ss", str(music_from), "-i", str(mus)]
    fc += [f"[{n}:a]volume={mvol},atrim=0:{total}[mus]", "[base][mus]amix=inputs=2:duration=first:normalize=0[mix]",
           f"[mix]afade=t=in:d=0.2,afade=t=out:st={total - 0.6}:d=0.6,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]"]
    master = tmp / "master.mp4"
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", f"[{last}]", "-map", "[a]",
         "-t", f"{total:.3f}", "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "20", "-maxrate", "8M",
         "-bufsize", "16M", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", str(master)])
    preview = tmp / "preview.mp4"
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(master), "-vf", "scale=540:960", "-c:v", "libx264", "-crf", "27",
         "-preset", "slow", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "64k", str(preview)])
    # the clean cover: the sharpest frame around the payoff of the first shot, without words
    cover = tmp / "cover.jpg"
    first = v["shots"][0]
    at = min(total - 0.3, max(0.3, (first.get("peak", first["start"] + first["len"] / 2) - first["start"]) / max(first.get("speed", 1), 0.5)))
    best, best_sharp = None, -1
    for k, dt in enumerate((-0.4, -0.2, 0, 0.2, 0.4)):
        fp = tmp / f"c{k}.jpg"
        tt = min(total - 0.2, max(0.1, at + dt))
        run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{tt:.2f}", "-i", str(joined), "-frames:v", "1", "-q:v", "2", str(fp)])
        g = np.asarray(Image.open(fp).convert("L").resize((270, 480)), dtype=np.float32)
        sharp = float(np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]).mean())
        if sharp > best_sharp:
            best, best_sharp = fp, sharp
    Image.open(best).save(cover, quality=92)
    thumb = tmp / "thumb.jpg"
    thumbnail(best, t.get("thumb") or t["hook"], thumb)
    problems = checks(v, master, total)
    return {"master": master, "preview": preview, "cover": cover, "thumb": thumb, "duration": round(total, 2),
            "shots": log_shots, "problems": problems}


QA_PROMPT = """You check one finished short video of Chifbay, a small FAMILY business running private boat trips in Madeira,
before it is posted on Instagram, YouTube and TikTok. Words on screen: {hook!r}{labels}. Caption starts: {cap!r}.

Answer JSON only: {{"ok": true or false, "score": 1-10 (how good it is as a Reel), "problems": ["..."]}}
Set ok=false, with the reason in problems, if ANY of these is true:
- the camera mostly shows a guest's body in swimwear (from behind, close on skin) instead of the place, the boat or the activity
- the words on screen or the caption promise something the video does not show (e.g. "jump" with no jump)
- a child's face is close and clear, or a guest looks embarrassed, upset or in a private moment
- it is blurry, shaky, dark, or nothing happens
- another company's boat or brand is the main subject
Otherwise ok=true and problems=[]. Be strict: when in doubt, ok=false."""


def qa(v, preview):
    """A second look at the FINISHED video by Gemini, so the moment finder's mistakes do not reach the review page."""
    t = v["texts"]
    prompt = QA_PROMPT.format(hook=t["hook"], labels=f", then one line per shot {t['labels']}" if t.get("labels") else "", cap=t["ig"][:200])
    for key in gemini_keys():
        if key_spent(key):
            continue
        uri, name = gemini_upload(preview, key=key)
        try:
            ans, model = gemini([{"file_data": {"mime_type": "video/mp4", "file_uri": uri}}, {"text": prompt}], key=key, timeout=180)
            return {"ok": bool(ans.get("ok")), "score": ans.get("score"), "problems": [str(p)[:200] for p in ans.get("problems", [])], "model": model}
        except QuotaGone:
            continue
        finally:
            gemini_delete(name, key=key)
    return {"ok": None, "problems": ["second look not done: Gemini free calls spent for today"]}


def main():
    only = set(a for a in sys.argv[1:] if not a.startswith("-"))
    plan = read_json(PLAN, {"videos": []})
    moments = read_json(HERE / "moments.json", {"files": {}})
    todo = [v for v in plan["videos"] if (v["id"] in only) or (not only and v.get("status") == "draft")]
    log(f"{len(todo)} videos to build")
    built = 0
    for v in todo:
        log(f"- {v['id']} {v['format']}: {v['texts']['hook']}")
        try:
            with tempfile.TemporaryDirectory() as td:
                r = build(v, moments, pathlib.Path(td))
                if not r["problems"]:
                    try:
                        v["qa"] = qa(v, r["preview"])
                    except Exception as e:
                        v["qa"] = {"ok": None, "problems": [f"second look failed: {str(e)[:160]}"]}
                    if v["qa"]["ok"] is False:
                        r["problems"] += [f"second look: {p}" for p in v["qa"]["problems"]] or ["second look refused it"]
                    log(f"  second look: {v['qa']}")
                ver = hashlib.sha1(r["master"].read_bytes()).hexdigest()[:8]
                stem = f"{v['id']}-{ver}"
                urls = {"video": media_put(f"{stem}.mp4", r["master"], "video/mp4"),
                        "preview": media_put(f"{stem}-p.mp4", r["preview"], "video/mp4"),
                        "cover": media_put(f"{stem}-cover.jpg", r["cover"], "image/jpeg"),
                        "thumb": media_put(f"{stem}-thumb.jpg", r["thumb"], "image/jpeg")}
                v["render"] = {**urls, "duration": r["duration"], "bytes": r["master"].stat().st_size, "shots": r["shots"],
                               "checks": {"ok": not r["problems"], "problems": r["problems"]},
                               "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                v["status"] = "rendered" if not r["problems"] else "failed"
                log(f"  {r['duration']} s, {v['render']['bytes'] / 1e6:.1f} MB, " + ("ok" if not r["problems"] else "FAILED: " + "; ".join(r["problems"])))
                built += 1
        except Exception as e:
            v["status"] = "failed"
            v["render"] = {"checks": {"ok": False, "problems": [str(e)[:300]]}, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            log(f"  FAILED: {e}")
        write_json(PLAN, plan)
    log(f"{built} built")


if __name__ == "__main__":
    main()
