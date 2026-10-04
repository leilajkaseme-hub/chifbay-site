#!/usr/bin/env python3
"""make-webp.py: a WebP copy next to every JPEG the site uses.

    python3 scripts/make-webp.py            write the missing or stale files
    python3 scripts/make-webp.py --check    list what would be written, write nothing

Why: the photos were 250 to 780 KB JPEGs, so a phone on a slow line spent most
of its time downloading pictures (book page 3.8 MB, home page 6.2 MB, 4 Oct
2026). WebP at quality 78 is about a third of that for the same look.

What it writes, next to each assets/**/<name>.jpg that a page, a stylesheet or
a script names:
  <name>.webp        longest side at most 1600 px, quality 78
  <name>-800.webp    800 px wide, quality 66, only for photos straight under assets/ that
                     are wider than 900 px: the phone size of the big header
                     photos and trip cards of the booking pages. A tall photo
                     is cut to 800 x 1000 around its middle: on a phone it is
                     shown in a box no taller than that, so the rest was
                     never seen (exp-coves went from 185 to about 100 KB).

The JPEG is never touched: it stays the fallback for old browsers and the image
social networks and search engines read (og:image, JSON-LD).

A file is rewritten only when the JPEG is newer than its WebP, so a second run
writes nothing. Pages are switched to the WebP files by scripts/use-webp.mjs,
which only points at a WebP that exists: run this first.
"""
import os
import re
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK = "--check" in sys.argv
QUALITY = 78
MAX_SIDE = 1600
SMALL_W = 800
SMALL_MAX_H = 1000
SMALL_QUALITY = 66      # the phone copies: seen small, mostly under a dark scrim
SKIP_DIRS = {".git", "node_modules", "ig", "ig-auto", "social", "social-drive", "social-iphone",
             "story-9x16", "zz-test", "vendor"}
TEXT = (".html", ".css", ".js", ".json")
REF = re.compile(r"assets/[\w./%-]+?\.jpe?g", re.I)


def referenced():
    """Every assets/...jpg path named in a page, stylesheet, script or data file."""
    out = set()
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".")]
        for f in files:
            if not f.endswith(TEXT):
                continue
            try:
                s = open(os.path.join(d, f), encoding="utf8").read()
            except (UnicodeDecodeError, OSError):
                continue
            for m in REF.finditer(s):
                p = os.path.join(ROOT, m.group(0))
                if os.path.isfile(p):
                    out.add(os.path.normpath(p))
    return sorted(out)


def stale(src, dst):
    return not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)


def save(im, dst, quality=QUALITY):
    im.save(dst, "WEBP", quality=quality, method=6)


def main():
    wrote = 0
    for src in referenced():
        base = os.path.splitext(src)[0]
        targets = [(base + ".webp", None)]
        top_level = os.path.dirname(src) == os.path.join(ROOT, "assets")
        with Image.open(src) as probe:
            w = probe.size[0]
        if top_level and w > 900:
            targets.append((base + "-%d.webp" % SMALL_W, SMALL_W))
        todo = [t for t in targets if stale(src, t[0])]
        if not todo:
            continue
        if CHECK:
            for dst, _ in todo:
                print("would write", os.path.relpath(dst, ROOT))
            continue
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            for dst, width in todo:
                out = im.copy()
                if width:
                    out = out.resize((width, round(out.size[1] * width / out.size[0])), Image.LANCZOS)
                    if out.size[1] > SMALL_MAX_H:
                        top = (out.size[1] - SMALL_MAX_H) // 2
                        out = out.crop((0, top, width, top + SMALL_MAX_H))
                else:
                    out.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
                save(out, dst, SMALL_QUALITY if width else QUALITY)
                wrote += 1
                print("wrote", os.path.relpath(dst, ROOT), "%d KB" % (os.path.getsize(dst) // 1024))
    print("%d WebP file(s) %s." % (wrote, "written" if not CHECK else "checked"))


if __name__ == "__main__":
    main()
