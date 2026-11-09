#!/usr/bin/env python3
"""Chifbay "old money" Reels: one client trip (projects/<day>.json) cut to a song, a different set of shots for each
song, colour palette, serif and script titles, the logo at the end.

    python3 oldmoney.py build <day> [--look a,b] [song...]   the Reels of one trip, one per song (the trip's `songs`, else
                                              all SONGS), into OUT/<day>/: <song>.mp4 (silent, to post with the song
                                              added in the app), <song>-cover.jpg and -cover-4x5.jpg, <song>-edit.json, and
                                              <song>-preview.mp4 (with the song, never post it) when music/ has the song,
                                              else <song>-small.mp4 (silent 1080p, light, to send) for `mux`
    python3 oldmoney.py candidates <day>      every few seconds of the trip's `videos`, framed on the boat, on one sheet
                                              (OUT/<day>/candidates-*.jpg + .json): pick the good ones into `shots`
    python3 oldmoney.py mux <day>             add the song to each <song>-small.mp4: <song>-preview.mp4 (to judge the cut)
    python3 oldmoney.py beats <song...>       the exact beat grid and hits of music/<song>-preview.m4a (needs librosa)
    python3 oldmoney.py looks <out.jpg> <frame[@x]>...   every palette side by side on the same frames

Where things are: this folder (in the site repo) holds the code, fonts, beats/ and projects/. The songs and the renders
are never in git: OLDMONEY_DATA (default stores/chifbay/oldmoney) holds music/ and out/. The videos are streamed from
the Drive when OLDMONEY_DRIVE names the file written by `node ig-auto/bin/drive-scan.mjs urls <file>` (GitHub Actions:
.github/workflows/oldmoney-render.yml, so no 4K ever lands on the MacBook), else read from OLDMONEY_DATA/media/.

Style (Theo, 8 and 9 Nov 2026, references: "Old Money" serif + script poster, "Vice Yacht Club" gold caps):
  one line at the start over a calm wide shot, plain hard cuts (no zoom or move added), the logo on the last bar.
  Cuts follow the song: a cut on each strong hit, a held shot through the softer beats (up to 4). Each song of a trip
  uses its own shots (Theo, 9 Nov: "chaque video = contenu different"). Footage: clean drone and on-board shots only
  (no 360 reframes, no shaky phone clips); 59.94 fps drone shots play at half speed. Colour: Sapphire & Orange (Theo's
  pick), with natural skin. Fonts (all OFL, in fonts/): Playfair Display, Pinyon Script, Oswald.
"""
import json
import os
import pathlib
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent
DATA = pathlib.Path(os.environ.get("OLDMONEY_DATA") or SITE.parent / "oldmoney")
OUT, MUSIC, MEDIA = DATA / "out", DATA / "music", DATA / "media"
FONTS, PROJECTS, BEATS = HERE / "fonts", HERE / "projects", HERE / "beats"
LOGO = SITE / "assets" / "logo-white.png"
W, H, FPS = 1080, 1920, 30      # 30 fps: the 59.94 fps drone shots at half speed, frame for frame
GOLD, CREAM = (238, 217, 163), (248, 243, 230)

# Colour palettes (v5, 8 Nov). Theo turned down two rounds of film filters (v3 six soft film looks: "pretty much the
# same filter every time"; v4 six strong looks: "dont like any of those") and asked for other COLOURS, not filters.
# So: no grain, no glow, no faded blacks, no dark corners. Only the colours change: the sea, the light on the boat,
# the cliffs. huesaturation moves one colour range (b+c = the sea, r+y = the cliffs and skin); selectivecolor warms
# the whites. All the colour work runs in 16-bit RGB so the sky never shows bands.
LOOKS = {
    "navy-champagne": ("huesaturation=hue=8:saturation=0.55:intensity=-0.06:colors=b+c:strength=8,"
                       "selectivecolor=whites='0 0.04 0.18 0':neutrals='0 0.02 0.06 0':yellows='-0.05 0 0.1 0',"
                       "curves=all='0/0 0.25/0.23 0.75/0.78 1/1'"),
    "emerald-gold": ("huesaturation=hue=-40:saturation=0.45:colors=b+c:strength=10,"
                     "selectivecolor=whites='0 0.04 0.16 0':neutrals='0 0.02 0.06 0':yellows='-0.05 0 0.12 0'"),
    "turquoise-sand": ("huesaturation=hue=-20:saturation=0.6:intensity=0.1:colors=b+c:strength=10,"
                       "huesaturation=hue=6:saturation=-0.2:colors=r+y:strength=6,"
                       "selectivecolor=whites='0 0.02 0.08 0',curves=all='0/0.02 0.5/0.56 1/1'"),
    # Theo's pick (8 Nov). After "the persons are too red in skin": the orange push goes to the yellows only (the lit
    # cliffs); the reds (skin) lose a little colour and turn a touch towards yellow, so faces stay natural
    "sapphire-orange": ("huesaturation=hue=14:saturation=0.5:colors=b+c:strength=10,"
                        "huesaturation=hue=4:saturation=-0.12:colors=r:strength=6,"
                        "huesaturation=hue=-2:saturation=0.22:colors=y:strength=6,"
                        "curves=all='0/0 0.3/0.27 0.7/0.74 1/1'"),
    # the same for bright midday footage, where the sea is already deep blue: a light touch on the sea
    "sapphire-orange-day": ("huesaturation=hue=6:saturation=0.08:intensity=-0.03:colors=b+c:strength=10,"
                            "huesaturation=hue=4:saturation=-0.12:colors=r:strength=6,"
                            "huesaturation=hue=-2:saturation=0.22:colors=y:strength=6,"
                            "selectivecolor=whites='0 0.02 0.08 0',curves=all='0/0 0.3/0.28 0.7/0.73 1/1'"),
    "bronze": ("huesaturation=saturation=-0.7:colors=b+c:strength=10,"
               "colorbalance=rs=0.08:gs=0.02:bs=-0.08:rm=0.06:gm=0.02:bm=-0.08,"
               "selectivecolor=whites='0 0.04 0.14 0'"),
    "olive-cream": ("huesaturation=saturation=-0.3,"
                    "huesaturation=hue=-25:saturation=-0.3:colors=b+c:strength=10,"
                    "huesaturation=hue=-8:colors=y+g:strength=6,"
                    "selectivecolor=whites='0 0.03 0.12 0':neutrals='0 0.01 0.05 0'"),
}
LOOK = "sapphire-orange"


def grade(name):
    """The palette as a filter chain: use it inside -filter_complex, after [0:v] or a chain."""
    return f"format=rgb48le,{LOOKS[name]},format=yuv420p"


# The songs. Only Apple's official 30 s previews are used (music/, never in git, never posted: the song is added in the
# Instagram app). Each song is a fixed beat grid: bpm and the time of its first beat in the preview, in beats/<song>.json
# from `beats <song>` (fitted on the drum hits near the bpm given here, to the millisecond: Theo, 9 Nov: "it's not right on the beat, it's very
# messy", librosa's own beats wobbled by up to 50 ms and had Tourner at 117.5 bpm instead of 120). beats/<song>.json
# keeps the hit per beat (`accent`). drop = the beat where the first cut lands (by ear: where the song opens up), the
# title plays the `intro` beats before it. bars = how many bars of 4 beats are cut. pace = which cut pattern a bar
# gets from its hits (see BAR_CUTS): fast for Monaco (Theo liked it fast, 8 Nov), calm for the ballads.
SONGS = {
    "monaco":  {"name": "MONACO, Bad Bunny", "bpm": 138.92, "drop": 20.73, "intro": 8, "bars": 4, "pace": "fast",
                "title": {"script": "this is not", "serif": "Monaco", "caps": "PRIVATE BOAT · FUNCHAL"},
                "cover": {"script": "not Monaco", "serif": "Madeira", "caps": "CHIFBAY · PRIVATE BOAT TRIPS"}},
    "skyfall": {"name": "Skyfall, Adele", "bpm": 74.96, "drop": 16.47, "intro": 4, "bars": 3, "pace": "calm",
                "title": {"script": "shaken, not", "serif": "Stirred", "caps": "PRIVATE BOAT · FUNCHAL"}},
    "sway":    {"name": "Sway, Michael Bublé", "bpm": 126.00, "drop": 6.34, "intro": 8, "bars": 7, "pace": "calm",
                "title": {"script": "la dolce", "serif": "Vita", "caps": "PRIVATE BOAT · FUNCHAL"}},
    "tourner": {"name": "Tourner dans le vide, Indila", "bpm": 120.03, "drop": 17.20, "intro": 8, "bars": 5, "pace": "medium",
                "title": {"script": "ce n'est pas", "serif": "St-Tropez", "caps": "BATEAU PRIVÉ · FUNCHAL"}},
}
# How a bar of 4 beats is cut, from how hard it hits compared with the song's other bars (strong, mid, weak). Only 1, 2
# and 4 beats: a shot never holds 3 beats, so every cut stays on the bar's grid.
BAR_CUTS = {
    "fast":   {"strong": [1, 1, 1, 1], "mid": [1, 1, 2], "weak": [2, 1, 1]},
    "medium": {"strong": [1, 1, 2], "mid": [2, 2], "weak": [2, 1, 1]},
    "calm":   {"strong": [2, 1, 1], "mid": [2, 2], "weak": [4]},
}
END_BEATS = 4
ENDLINE = "MADEIRA"


def run(*cmd):
    """Run a command; a Drive read that Google turns down for a moment (403/429/5xx when many reads run at once) is
    tried again, 6 times, waiting longer each time (about 10 minutes in all)."""
    for attempt in range(7):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if not r.returncode:
            return r.stdout
        busy = any("googleapis" in str(c) for c in cmd) and any(f" {c} " in r.stderr for c in ("403", "429", "500", "503"))
        if not busy or attempt == 6:
            raise RuntimeError(f"{cmd[0]} failed: {r.stderr.strip()[-600:]}")
        time.sleep(30 * (attempt + 1))


def font(name, size, weight=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    if weight:
        f.set_variation_by_axes([weight])
    return f



# ---- the videos: streamed from the Drive, or local copies -------------------------------------------------------

_drive, _probe = {}, {}


def drive():
    """The Drive file list and a read-only token (OLDMONEY_DRIVE), refreshed when it is 40 minutes old: tokens last
    an hour and a trip can take longer to render."""
    path = os.environ.get("OLDMONEY_DRIVE")
    if not path:
        return None
    if not _drive or time.time() - _drive["at"] > 40 * 60:
        if _drive:
            run("node", str(SITE / "ig-auto" / "bin" / "drive-scan.mjs"), "urls", path)
        _drive.update(json.loads(pathlib.Path(path).read_text()), at=time.time())
    return _drive


def source(name):
    """(ffmpeg options before -i, input) for a video of the Drive."""
    d = drive()
    if d:
        f = d["files"].get(name)
        if not f:
            raise SystemExit(f"{name} is not on the Drive")
        return (["-headers", f"Authorization: Bearer {d['token']}\r\n"],
                f"https://www.googleapis.com/drive/v3/files/{f['id']}?alt=media&supportsAllDrives=true")
    path = MEDIA / name
    if not path.exists():
        raise SystemExit(f"{name}: set OLDMONEY_DRIVE (see the top of this file) or put a copy in {MEDIA}")
    return [], str(path)


def probe(name):
    """(duration s, height px) of a video, asked once."""
    if name not in _probe:
        opts, src = source(name)
        out = run("ffprobe", "-v", "error", *opts, "-select_streams", "v:0", "-show_entries", "stream=height:format=duration",
                  "-of", "default=nw=1", src)
        f = dict(line.split("=", 1) for line in out.split())
        _probe[name] = (float(f["duration"]), int(f["height"]))
    return _probe[name]


# ---- a trip: projects/<day>.json ---------------------------------------------------------------------------------

def project(day):
    path = PROJECTS / f"{day}.json"
    if not path.exists():
        raise SystemExit(f"no project {path.name}: {', '.join(sorted(x.stem for x in PROJECTS.glob('*.json')))}")
    return json.loads(path.read_text())


def library(proj):
    """{shot id: shot} from the trip's `shots`: [video name on the Drive, start s in it, centre of the 9:16 crop (0 left,
    1 right), speed, tags]. Speed 0.5 = smooth slow motion of a 59.94 fps drone file. A video smaller than 4K is blown
    up to fill the frame, so it gets a light sharpening. Tags: intro (a calm wide shot that carries the title and the
    cover), high (the title goes high, over the sky), end (under the logo), wide (good for a held shot), people (the
    guests, close), scene:<name> (see scene())."""
    lib = {}
    for sid, (name, t, x, speed, *tags) in proj["shots"].items():
        dur, height = probe(name)
        avail = (dur - t) / speed
        if proj.get("videos", {}).get(name, {}).get("edit"):
            avail = min(avail, 1.4)                  # an edited video: the next cut or fade may come soon after
        lib[sid] = {"id": sid, "name": name, "t": t, "avail": avail, "x": x, "speed": speed,
                    "sharpen": height < 2000, "tags": set((tags[0] if tags else "").split())}
    return lib

# ---- candidates: every few seconds of every video of a trip, framed, on one sheet to pick from ------------------

def frame_at(name, t, w=480):
    """One frame (RGB array, w px wide) of a video at t s."""
    opts, src = source(name)
    raw = subprocess.run(["ffmpeg", "-v", "error", *opts, "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1",
                          "-vf", f"scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    h = len(raw) // (w * 3)
    return np.frombuffer(raw[:w * h * 3], np.uint8).reshape(h, w, 3) if h else None


def boat_x(img):
    """Where the white hull is (0 left, 1 right): the column with the most white, low-colour pixels, sky left out.
    0.5 when nothing white stands out (a cliff, the sea)."""
    a = img[int(img.shape[0] * 0.25):].astype(int)
    white = (a.min(axis=2) > 185) & (a.max(axis=2) - a.min(axis=2) < 45)
    cols = np.convolve(white.sum(axis=0), np.ones(25) / 25, "same")
    if cols.max() < 3:
        return 0.5
    return float(np.argmax(cols)) / img.shape[1]


def crop_x(bx):
    """The crop centre that puts a point at bx (0 to 1 of the 16:9 frame) in the middle of the 9:16 frame."""
    share = (W / H * 9 / 16)                        # the 9:16 crop is 0.316 of a 16:9 frame
    return float(np.clip((bx - share / 2) / (1 - share), 0, 1))


def red_guard(img, x):
    """True when the drone's red propeller guard shows inside the 9:16 crop at x."""
    share = (W / H * 9 / 16)
    a0 = int((x * (1 - share)) * img.shape[1]); a1 = int(a0 + share * img.shape[1])
    a = img[:, a0:a1].astype(int)
    red = (a[..., 0] > 170) & (a[..., 1] < 100) & (a[..., 2] < 110)
    return red.mean() > 0.004


def candidates(day):
    """The project's `videos` ({name: {"speed", "every", "from", "to", "edit"}}) sampled every `every` s: each
    candidate framed on the boat, crossfades (in edited videos) and the red guard left out, then one sheet of 9:16
    thumbnails with their ids (OUT/<day>/candidates-<page>.jpg) and candidates.json, to copy the good ones into `shots`."""
    from concurrent.futures import ThreadPoolExecutor
    proj = project(day)
    jobs = []
    for name, o in proj["videos"].items():
        dur, _ = probe(name)
        t, end, every = o.get("from", 0.5), min(o.get("to", dur), dur - 2), o.get("every", 3)
        while t < end:
            jobs.append((name, round(t, 2), o))
            t += every

    def look(job):
        name, t, o = job
        img = frame_at(name, t)
        if img is None:
            return None
        if o.get("edit"):                            # an edited video: a crossfade or a cut inside the shot = no
            later = frame_at(name, t + 1.2)
            if later is None or np.abs(img.astype(int) - later.astype(int)).mean() > 38:
                return None
        x = round(crop_x(boat_x(img)), 2)
        if red_guard(img, x):
            return None
        return {"name": name, "t": t, "x": x, "speed": o.get("speed", 0.5), "img": img}

    with ThreadPoolExecutor(6) as ex:
        found = [c for c in ex.map(look, jobs) if c]
    out = OUT / day
    out.mkdir(parents=True, exist_ok=True)
    short = {n: f"{i + 1}" for i, n in enumerate(proj["videos"])}
    tw, th, cols, per = 135, 240, 16, 112             # pages of 7 rows, readable at a glance
    lab = font("Oswald-VF.ttf", 17, 500)
    rows = {}
    for page in range((len(found) + per - 1) // per):
        part = found[page * per:(page + 1) * per]
        sheet = Image.new("RGB", (cols * tw, ((len(part) + cols - 1) // cols) * (th + 22)), (20, 20, 20))
        d = ImageDraw.Draw(sheet)
        for i, c in enumerate(part):
            cid = f"v{short[c['name']]}-{c['t']:g}"
            img = Image.fromarray(c.pop("img"))
            cw = img.height * 9 / 16                 # the 9:16 crop, as the Reel shows it
            a0 = c["x"] * (img.width - cw)
            thumb = img.crop((int(a0), 0, int(a0 + cw), img.height)).resize((tw, th))
            sheet.paste(thumb, ((i % cols) * tw, (i // cols) * (th + 22)))
            d.text(((i % cols) * tw + 4, (i // cols) * (th + 22) + th + 2), cid, font=lab, fill=GOLD)
            rows[cid] = [c["name"], c["t"], c["x"], c["speed"], ""]
        sheet.save(out / f"candidates-{page + 1}.jpg", quality=82)
    (out / "candidates.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    print(f"{day}: {len(found)} candidates of {len(jobs)} looked at; videos: " + ", ".join(f"v{s} = {n}" for n, s in short.items()))


# ---- titles ----------------------------------------------------------------------------------------------------

def shadowed(layer_size, draw_fn, blur=10, alpha=150):
    """Draw text twice: a soft dark shadow, then the text, so it reads over bright sky and water."""
    base = Image.new("RGBA", layer_size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", layer_size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(shadow), (0, 0, 0, alpha), 3)
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(blur)))
    text = Image.new("RGBA", layer_size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(text), None, 0)
    base.alpha_composite(text)
    return base


def centred(d, y, s, f, fill, dy=0, spacing=0, dx=0):
    """One line centred on the frame; `spacing` adds (or, negative, removes) pixels between letters."""
    if spacing:
        widths = [d.textlength(ch, font=f) for ch in s]
        x = (W - (sum(widths) + spacing * (len(s) - 1))) / 2 + dx
        for ch, cw in zip(s, widths):
            d.text((x, y + dy), ch, font=f, fill=fill)
            x += cw + spacing
        return
    d.text(((W - d.textlength(s, font=f)) / 2 + dx, y + dy), s, font=f, fill=fill)


def lockup(draw_on, words, top, shade=None):
    """The references' lockup, set tight: a big serif word (letters pulled together), a big script line laid over
    its upper half and shifted right (as "Old" over "Money"), small gold capitals right under the serif."""
    d = draw_on
    caps = font("Oswald-VF.ttf", 46, 600)
    ssize = 270
    while True:                                   # the serif word fits the frame (St-Tropez is longer than Monaco)
        serif = font("PlayfairDisplay-VF.ttf", ssize, 800)
        if d.textlength(words["serif"], font=serif) - 9 * len(words["serif"]) <= W * 0.9 or ssize <= 150:
            break
        ssize -= 10
    size, dx = 235, 70
    while True:                                   # the script line fits the frame, shift included
        script = font("PinyonScript-Regular.ttf", size)
        if d.textlength(words["script"], font=script) + 2 * dx <= W * 0.92 or size <= 120:
            break
        size, dx = size - 10, max(0, dx - 10)
    _, cap_top, _, cap_bottom = d.textbbox((0, top), "M", font=serif)
    baseline = cap_top + 0.17 * (cap_bottom - cap_top)   # the script dips into the top of the serif word, as "Old" into "Money"
    centred(d, top, words["serif"], serif, shade or CREAM, spacing=-9)
    centred(d, baseline - script.getmetrics()[0], words["script"], script, shade or GOLD, dx=dx)
    centred(d, cap_bottom + 26, words["caps"], caps, shade or GOLD, spacing=3)


def title_card(t, path, top=760):
    """The opening line over the intro."""
    shadowed((W, H), lambda d, shade, dy: lockup(d, t, top + dy, shade), blur=9, alpha=120).save(path)


def end_card(endline, path):
    """The last bar: a dark wash, the Chifbay logo, one gold word under it."""
    img = Image.new("RGBA", (W, H), (8, 14, 24, 120))
    logo = Image.open(LOGO).convert("RGBA")
    lw = 620
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    img.alpha_composite(logo, ((W - lw) // 2, H // 2 - logo.height // 2 - 40))
    d = ImageDraw.Draw(img)
    centred(d, H // 2 + logo.height // 2 + 10, endline, font("Oswald-VF.ttf", 54, 500), GOLD, spacing=18)
    img.save(path)


def cover(frame, c, out, out45):
    """The thumbnail: the graded frame with the same lockup, kept inside the 4:5 grid crop."""
    img = Image.open(frame).convert("RGBA").resize((W, H))
    img.alpha_composite(shadowed((W, H), lambda d, shade, dy: lockup(d, c, c.get("top", 700) + dy, shade), blur=10, alpha=140))
    img.convert("RGB").save(out, quality=92)
    y0 = (H - 1350) // 2
    img.crop((0, y0, W, y0 + 1350)).convert("RGB").save(out45, quality=92)



# ---- the cut -----------------------------------------------------------------------------------------------------

def beats_cmd(song):
    """Fit the song's beat grid: the bpm (within 1.5 of SONGS' bpm, or 60 to 180 for a new song) and the first beat
    whose grid sits best on the drum hits (librosa's percussive part, 3 ms steps), then the hit per beat. Prints the
    result to copy into SONGS."""
    import librosa  # only this step needs it
    sr, hop = 22050, 64
    wav = OUT / "tmp" / f"{song}.wav"         # librosa reads wav; the preview is m4a
    wav.parent.mkdir(parents=True, exist_ok=True)
    run("ffmpeg", "-v", "error", "-y", "-i", str(MUSIC / f"{song}-preview.m4a"), "-ac", "1", "-ar", str(sr), str(wav))
    y, _ = librosa.load(str(wav), sr=sr)
    wav.unlink()
    _, drums = librosa.effects.hpss(y)
    on = librosa.onset.onset_strength(y=drums, sr=sr, hop_length=hop)
    to = librosa.times_like(on, sr=sr, hop_length=hop)
    known = SONGS.get(song, {}).get("bpm")
    bpms = np.arange(known - 1.5, known + 1.5, 0.01) if known else np.arange(60, 180, 0.05)
    best = (0, 0, 0)
    for bpm in bpms:
        period = 60 / bpm
        for first in np.arange(0, period, 0.003):
            score = np.interp(np.arange(first, to[-1] - 0.05, period), to, on).mean()
            if score > best[0]:
                best = (score, bpm, first)
    _, bpm, first = best
    grid = np.arange(first, to[-1] - 0.05, 60 / bpm)
    acc = np.interp(grid, to, on)
    data = {"song": f"music/{song}-preview.m4a", "bpm": round(float(bpm), 2), "first": round(float(first), 3),
            "accent": [round(float(a / acc.max()), 3) for a in acc]}
    (BEATS / f"{song}.json").write_text(json.dumps(data, indent=1))
    print(f"{song}: bpm {data['bpm']}, first beat {data['first']}s, {len(grid)} beats: put them in SONGS, then set its drop by ear")


def song_grid(song):
    """(beat times in the edit from 0, where the song starts in the preview, beat length, hit per beat after the drop).
    The grid is exact (bpm and first beat), so a cut is never off by librosa's wobble."""
    s, bj = SONGS[song], json.loads((BEATS / f"{song}.json").read_text())
    period = 60 / bj["bpm"]
    n = len(bj["accent"])
    times = [bj["first"] + k * period for k in range(n)]
    i0 = int(round((s["drop"] - bj["first"]) / period))
    if i0 < s["intro"]:
        raise SystemExit(f"{song}: the drop is too early for {s['intro']} intro beats")
    need = i0 + 4 * s["bars"] + END_BEATS
    if need > n:
        raise SystemExit(f"{song}: {s['bars']} bars after the drop run past the end of the preview")
    t0 = times[i0 - s["intro"]]
    return [x - t0 for x in times[i0 - s["intro"]:need + 1]], t0, period, bj["accent"][i0:need]


def rhythm(song, accent):
    """Beats per shot after the drop: bar by bar, the bar's cut pattern (BAR_CUTS) from how hard it hits against the
    song's other bars. A 3-part pattern puts its long shot on the bar's softer half."""
    s = SONGS[song]
    bars = [accent[4 * b:4 * b + 4] for b in range(s["bars"])]
    power = [float(np.mean(b)) for b in bars]
    lo, hi = np.percentile(power, [34, 67]) if len(power) > 2 else (min(power), max(power))
    cuts = []
    for b, p in zip(bars, power):
        cut = list(BAR_CUTS[s["pace"]]["strong" if p >= hi else "weak" if p < lo else "mid"])
        if len(cut) == 3 and (b[0] + b[1] < b[2] + b[3]) == (cut[0] == 2):
            cut.reverse()                          # the two single beats go where the hits are
        cuts += cut
    return cuts


def scene(s):
    """What a shot shows: its `scene:<name>` tag (the same moment found in several edited videos of the day: the bow,
    the cake table...), else the shot itself. A scene is used once per trip."""
    return next((t for t in s["tags"] if t.startswith("scene:")), s["id"])


def auto_edit(lib, song, period, accent, taken, k):
    """An edit made from the song's rhythm and from shots no other song of this trip uses (`taken`): an intro shot
    long enough for the title, an end shot for the logo, then a view and the guests in turn. A held shot (3 beats or
    more) goes to a wide shot when one fits; two shots of the same video never follow each other. None when the trip
    has too few unused shots for this song."""
    free = [s for s in lib.values() if scene(s) not in taken]
    fits = lambda s, beats: s["avail"] >= beats * period + 0.15
    first = lambda tag, beats, avoid=None: next((s for s in free if tag in s["tags"] and fits(s, beats) and s is not avoid), None)
    intro = first("intro", SONGS[song]["intro"]) or first("wide", SONGS[song]["intro"])     # a wide shot can carry the title
    end = first("end", END_BEATS, intro) or first("wide", END_BEATS, intro)
    if not intro or not end:
        return None
    pool = [s for s in free if not s["tags"] & {"intro", "end"}]      # those wait for the next songs' title and logo
    turn = lambda xs: xs[k % len(xs):] + xs[:k % len(xs)] if xs else xs
    people = turn([s for s in pool if "people" in s["tags"]])
    views = turn([s for s in pool if "people" not in s["tags"]])
    order = [s for pair in zip(views, people) for s in pair] + views[len(people):] + people[len(views):]
    cuts, last, used = [], intro["name"], {scene(intro), scene(end)}
    for n in rhythm(song, accent):
        cands = [s for s in order if scene(s) not in used and fits(s, n)]
        if n >= 3:
            cands = [s for s in cands if "wide" in s["tags"]] + [s for s in cands if "wide" not in s["tags"]]
        pick = next((s for s in cands if s["name"] != last), None) or next(iter(cands), None)
        if pick is None:
            return None
        used.add(scene(pick))
        cuts.append([pick["id"], n])
        last = pick["name"]
    return {"intro": [[intro["id"], SONGS[song]["intro"]]], "cuts": cuts, "end": [end["id"], END_BEATS]}


def plan_trip(proj, lib, songs):
    """{song: edit}: each song takes shots the songs before it did not use. A hand-made edit (`edits`) goes first.
    A song the trip has no fresh shots left for is left out (said once)."""
    taken, plans = set(), {}
    for s in sorted(songs, key=lambda s: s not in proj.get("edits", {})):
        grid, t0, period, accent = song_grid(s)
        e = proj.get("edits", {}).get(s) or auto_edit(lib, s, period, accent, taken, len(plans))
        if e is None:
            print(f"{s}: not enough fresh shots left in this trip, left out")
            continue
        taken |= {scene(lib[sid]) for sid, _ in e["intro"] + e["cuts"]} | {scene(lib[e["end"][0]])}
        plans[s] = e
    return {s: plans[s] for s in songs if s in plans}


def vertical(x, sharpen=False):
    """The 9:16 frame cut from a 16:9 shot: full height, centred on x (0 left edge, 1 right edge)."""
    return f"scale=-2:{H}:flags=lanczos,crop={W}:{H}:'(iw-{W})*{x}':0,setsar=1" + (",unsharp=5:5:0.6" if sharpen else "")


def build(day, proj, lib, song, e, look, base):
    grid, t0, period, _ = song_grid(song)
    plan, i = [], 0
    for sid, n in e["intro"] + e["cuts"] + [e["end"]]:
        if sid not in lib:
            raise SystemExit(f"{day} {song}: shot {sid} is not in the project")
        end = min(i + n, len(grid) - 1)                    # the last shot may end with the song file
        if end <= i:
            raise SystemExit(f"{day} {song}: the edit is longer than the beats found in the song file")
        a, b = grid[i], grid[end]
        if (b - a) > lib[sid]["avail"] + 0.02:             # never run past the end of its video
            raise SystemExit(f"{day} {song}: {sid} lasts {lib[sid]['avail']:.2f}s, its slot needs {b - a:.2f}s")
        plan.append((sid, round(a * FPS), round(b * FPS)))  # whole frames, counted from the song grid: no drift
        i = end
    out, tmp = OUT / day, OUT / "tmp"
    out.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True, exist_ok=True)
    intro = lib[e["intro"][0][0]]
    top = proj.get("title_high", 300) if "high" in intro["tags"] else proj.get("title_top", 1180)
    title_card(SONGS[song]["title"], tmp / "title.png", top)
    end_card(ENDLINE, tmp / "end.png")
    inputs, graph, used = [], [], []
    for j, (sid, fa, fb) in enumerate(plan):
        s = lib[sid]
        dur = (fb - fa) / FPS
        used.append([sid, s["name"], s["t"], round(dur, 3)])
        opts, src = source(s["name"])
        inputs += [*opts, "-ss", f"{s['t']:.3f}", "-t", f"{dur * s['speed'] + 0.2:.3f}", "-i", src]
        # plain hard cut: no zoom or move added after a change (Theo, 8 Nov); only the drone's own glide, slowed down
        graph.append(f"[{j}:v]setpts=(PTS-STARTPTS)/{s['speed']},fps={FPS},trim=duration={dur:.4f},setpts=PTS-STARTPTS,"
                     f"{vertical(s['x'], s['sharpen'])},format=yuv420p[v{j}]")
    total = plan[-1][2] / FPS
    graph.append("".join(f"[v{j}]" for j in range(len(plan))) + f"concat=n={len(plan)}:v=1:a=0,{grade(look)}[g]")
    ti, ei = len(plan), len(plan) + 1
    inputs += ["-loop", "1", "-i", str(tmp / "title.png"), "-loop", "1", "-i", str(tmp / "end.png")]
    drop_t, end_t = plan[1][1] / FPS, plan[-1][1] / FPS
    graph.append(f"[{ti}:v]format=rgba,fade=t=in:st=0.15:d=0.45:alpha=1,fade=t=out:st={drop_t - 0.2:.3f}:d=0.2:alpha=1[ttl]")
    graph.append(f"[{ei}:v]format=rgba,fade=t=in:st={end_t:.3f}:d=0.35:alpha=1[end]")
    graph.append(f"[g][ttl]overlay=shortest=0:enable='lt(t,{drop_t:.3f})'[g1]")
    graph.append(f"[g1][end]overlay=shortest=0:enable='gte(t,{end_t:.3f})',trim=duration={total:.4f}[out]")
    name = song if look == base else f"{song}-{look}"
    silent = out / f"{name}.mp4"
    # high quality master (crf 16, film tune: keeps the fine detail of the 4K source)
    run("ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(graph), "-map", "[out]",
        "-c:v", "libx264", "-preset", "slow", "-tune", "film", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent))
    meta = {"song": SONGS[song]["name"], "look": look, "song_start_in_preview": round(t0, 3), "drop_at": round(drop_t, 3),
            "length": round(total, 3), "edit": e, "shots": used}
    (out / f"{name}-edit.json").write_text(json.dumps(meta, indent=1))
    # a light copy to send (1080p, under 30 MB); with the song when music/ has it (never post that one)
    small = out / f"{name}-small.mp4"
    run("ffmpeg", "-v", "error", "-y", "-i", str(silent), "-c:v", "libx264", "-preset", "slow", "-crf", "23",
        "-maxrate", "10M", "-bufsize", "20M", "-movflags", "+faststart", str(small))
    if (MUSIC / f"{song}-preview.m4a").exists():
        mux(out, name)
    build_cover(intro, top, song, look, out / f"{name}-cover.jpg", out / f"{name}-cover-4x5.jpg")
    print(f"{day}/{silent.name}: {total:.2f}s, {len(plan)} shots, the drop at {drop_t:.2f}s, the logo at {end_t:.2f}s")


def pcm(*args, sr=22050):
    """Mono float samples of an audio source (ffmpeg input arguments)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", *args, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def lateness(preview, song, t0, sr=22050):
    """How late (s) the preview's sound is against the song at t0: the peak of their cross-correlation, first 6 s."""
    a = pcm("-i", str(song), sr=sr)[int(t0 * sr):int(t0 * sr) + 6 * sr]
    b = pcm("-i", str(preview), "-vn", sr=sr)[:6 * sr]
    n = 1 << (len(a) + len(b)).bit_length()
    cc = np.fft.irfft(np.fft.rfft(b, n) * np.conj(np.fft.rfft(a, n)), n)
    lag = int(np.argmax(np.concatenate([cc[-sr // 5:], cc[:sr // 5]]))) - sr // 5   # within 0.2 s either way
    return lag / sr


def mux(out, name):
    """<name>-small.mp4 + the song from music/ -> <name>-preview.mp4, then the small copy goes. The sound is measured
    against the song and set again until it is within 3 ms: Apple's previews start with 2112 samples of encoder lead-in
    that came out as the song 45 to 48 ms late (Theo, 9 Nov: "not right on the beat")."""
    meta = json.loads((out / f"{name}-edit.json").read_text())
    song = next(k for k, v in SONGS.items() if v["name"] == meta["song"])
    t0, total = meta["song_start_in_preview"], meta["length"]
    src, prev = MUSIC / f"{song}-preview.m4a", out / f"{name}-preview.mp4"
    start = t0
    for _ in range(3):
        run("ffmpeg", "-v", "error", "-y", "-i", str(out / f"{name}-small.mp4"), "-i", str(src),
            "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-af", f"atrim=start={start:.5f}:duration={total:.4f},asetpts=PTS-STARTPTS,afade=t=out:st={total - 0.6:.3f}:d=0.6",
            "-movflags", "+faststart", str(prev))
        late = lateness(prev, src, t0)
        if abs(late) <= 0.003:
            break
        start += late
    else:
        raise SystemExit(f"{name}: the song stays {late * 1000:+.0f} ms off in the preview")
    (out / f"{name}-small.mp4").unlink()


def build_cover(intro, top, song, look, out, out45):
    """The cover: the middle of the video's own intro shot, with the song's line (its `cover` words, else its title)."""
    frame = OUT / "tmp" / "cover-src.png"
    opts, src = source(intro["name"])
    at = intro["t"] + min(intro["avail"], SONGS[song]["intro"] * 0.5) * intro["speed"] * 0.5
    run("ffmpeg", "-v", "error", "-y", *opts, "-ss", f"{at:.3f}", "-i", src, "-frames:v", "1",
        "-filter_complex", f"[0:v]{vertical(intro['x'], intro['sharpen'])},{grade(look)}", str(frame))
    cover(frame, dict(SONGS[song].get("cover") or SONGS[song]["title"], top=top), out, out45)


def looks_sheet(frames, out):
    """Every look side by side on the same frames (one row a frame, one column a look), the name under each,
    so Theo can pick one. A frame is a path, or path@x with x the centre of the 9:16 crop (0 to 1, 0.5 by default)."""
    tw, th = 540, 960
    names = ["original"] + list(LOOKS)
    sheet = Image.new("RGB", (tw * len(names), (th + 70) * len(frames)), (12, 12, 12))
    d = ImageDraw.Draw(sheet)
    lab = font("Oswald-VF.ttf", 34, 500)
    tmp = OUT / "tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    for row, spec in enumerate(frames):
        path, _, x = spec.partition("@")
        x = float(x or 0.5)
        for col, n in enumerate(names):
            png = tmp / f"look-{row}-{n}.png"
            g = f"[0:v]{vertical(x)}" + ("" if n == "original" else f",{grade(n)}")
            run("ffmpeg", "-v", "error", "-y", "-i", path, "-frames:v", "1", "-filter_complex", g, str(png))
            im = Image.open(png).convert("RGB").resize((tw, th), Image.LANCZOS)
            sheet.paste(im, (col * tw, row * (th + 70)))
            d.text((col * tw + tw // 2, row * (th + 70) + th + 35), n.upper(), font=lab, fill=GOLD if n != "original" else CREAM, anchor="mm")
    sheet.save(out, quality=90)
    print(f"{out}: {len(frames)} frames x {len(names)} looks")



if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == "looks":
        looks_sheet(a[2:], a[1])
    elif len(a) >= 2 and a[0] == "beats":
        for s in a[1:]:
            beats_cmd(s)
    elif len(a) == 2 and a[0] == "candidates":
        candidates(a[1])
    elif len(a) == 2 and a[0] == "mux":
        out = OUT / a[1]
        for small in sorted(out.glob("*-small.mp4")):
            mux(out, small.name[:-len("-small.mp4")])
            print(f"{a[1]}/{small.name[:-len('-small.mp4')]}-preview.mp4")
    elif len(a) >= 2 and a[0] == "build":
        day, args = a[1], a[2:]
        proj = project(day)
        base = proj.get("look", LOOK)                  # a trip may need its own palette (bright midday footage)
        looks = [base]
        if args[:1] == ["--look"]:
            looks, args = args[1].split(","), args[2:]
        for lk in looks:
            if lk not in LOOKS:
                raise SystemExit(f"no look {lk}: {', '.join(LOOKS)}")
        songs = args or proj.get("songs")
        if not songs:                                  # all songs, the first one turning from trip to trip: a trip with
            days = sorted(x.stem for x in PROJECTS.glob("*.json"))     # shots for 2 songs only still varies the songs
            k = days.index(day) % len(SONGS)
            songs = list(SONGS)[k:] + list(SONGS)[:k]
        for s in songs:
            if s not in SONGS:
                raise SystemExit(f"no song {s}: {', '.join(SONGS)}")
        lib = library(proj)
        plans = plan_trip(proj, lib, songs)
        for lk in looks:
            for s, e in plans.items():
                build(day, proj, lib, s, e, lk, base)
    else:
        print(__doc__)
