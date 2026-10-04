// webp.mjs: point a page's photos at the WebP copies, JPEG kept as fallback.
//
//   import { webpify } from "./lib/webp.mjs";
//   html = webpify(html, absolutePathOfThePage);
//
// Used by scripts/use-webp.mjs on every page, and by the generators that write
// photo markup (so running a generator again gives the same bytes back).
// The WebP files themselves come from scripts/make-webp.py; a photo with no
// WebP next to it, or one whose WebP is not smaller, is left as it is.
//
// What changes, and why each form:
//   <img src="x.jpg">            -> <picture><source type="image/webp" srcset="x.webp"><img src="x.jpg"></picture>
//                                   (a <source srcset="y.jpg"> already in a picture gets a WebP twin first)
//   style="background-image:url('x.jpg')"   in the first screen (inside the
//                                   first <header>, or a hero .hbg/.bkhbg):
//                                   the JPEG declaration, then an image-set()
//                                   one that old browsers drop
//   the same below the first screen, on pages that load tide.js and the theme
//   script: the photo moves into --bg / --bgw and data-lzbg, so it is not
//   downloaded until tide.js sees it come near the screen. With JavaScript
//   off (no data-theme on <html>) tide.css shows it at once.
//   <link rel="preload" as="image" href="x.jpg"> -> the WebP, with type="image/webp"
// og:image, JSON-LD, video posters and data-* attributes are never touched:
// social networks and crawlers keep reading the JPEG.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function diskPath(ref, pageFile) {
  const clean = ref.split(/[?#]/)[0];
  if (/^(https?:)?\/\//.test(clean) || clean.startsWith("data:")) return null;
  const abs = clean.startsWith("/") ? path.join(ROOT, clean) : path.join(path.dirname(pageFile), clean);
  return decodeURIComponent(abs);
}

// the WebP reference for a JPEG reference, or null when there is none worth using
export function webpRef(ref, pageFile) {
  if (!/\.jpe?g(?=$|[?#])/i.test(ref)) return null;
  const jpg = diskPath(ref, pageFile);
  if (!jpg || !fs.existsSync(jpg)) return null;
  const webp = jpg.replace(/\.jpe?g$/i, ".webp");
  if (!fs.existsSync(webp) || fs.statSync(webp).size >= fs.statSync(jpg).size) return null;
  return ref.replace(/\.jpe?g(?=$|[?#])/i, ".webp");
}

const imageSet = (q, w, j) => `image-set(url(${q}${w}${q}) type(${q}image/webp${q}),url(${q}${j}${q}) type(${q}image/jpeg${q}))`;

function webpSrcset(srcset, pageFile) {
  const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const [u, ...d] = p.split(/\s+/);
    const w = webpRef(u, pageFile);
    if (!w) return null;
    out.push([w, ...d].join(" "));
  }
  return out.join(", ");
}

function insidePicture(html, at) {
  const open = html.lastIndexOf("<picture", at);
  return open !== -1 && open > html.lastIndexOf("</picture>", at);
}

function doImages(html, pageFile) {
  // 1. twins for <source srcset="...jpg"> inside existing pictures
  html = html.replace(/<source\b(?![^>]*type=)[^>]*>/g, (tag, at) => {
    const m = /\bsrcset="([^"]+)"/.exec(tag);
    if (!m || !/\.jpe?g/i.test(m[1])) return tag;
    const before = html.slice(Math.max(0, at - 400), at);
    const w = webpSrcset(m[1], pageFile);
    if (!w) return tag;
    const twin = tag.replace(m[0], `srcset="${w}"`).replace(/^<source/, '<source type="image/webp"');
    if (before.endsWith(twin)) return tag;
    return twin + tag;
  });
  // 2. every <img> with a JPEG
  return html.replace(/<img\b[^>]*>/g, (tag, at, whole) => {
    const src = /\bsrc="([^"]+)"/.exec(tag);
    if (!src) return tag;
    const own = /\bsrcset="([^"]+)"/.exec(tag);
    const w = own ? webpSrcset(own[1], pageFile) : webpRef(src[1], pageFile);
    if (!w) return tag;
    const sizes = /\bsizes="([^"]+)"/.exec(tag);
    const source = `<source type="image/webp" srcset="${w}"${sizes ? ` sizes="${sizes[1]}"` : ""}>`;
    if (whole.slice(Math.max(0, at - source.length), at) === source) return tag;
    if (insidePicture(whole, at)) return source + tag;
    return `<picture>${source}${tag}</picture>`;
  });
}

function doBackgrounds(html, pageFile, lazyOk) {
  const body = html.indexOf("<body");
  const headerEnd = html.indexOf("</header>", body);
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*?)\sstyle="([^"]*)"([^>]*)>/g, (tag, name, pre, style, post, at) => {
    if (at < body || /image-set\(|--bg:/.test(style)) return tag;
    const m = /url\((['"]?)([^'")]+)\1\)/.exec(style);
    if (!m || !/^background(-image)?:/.test(style.trim().split(";").find((d) => d.includes(m[0])) || "")) return tag;
    const w = webpRef(m[2], pageFile);
    if (!w) return tag;
    const q = m[1] || "'";
    const attrs = pre + post;
    const hero = /\bclass="[^"]*\b(hbg|bkhbg)\b/.test(attrs);
    const eager = hero || !lazyOk || (headerEnd !== -1 && at < headerEnd);
    let s = style.replace(/;\s*$/, "");
    if (eager) {
      s = `${s};background-image:${imageSet(q, w, m[2])}`;
      return `<${name}${pre} style="${s}"${post}>`;
    }
    // lazy: the inline declaration no longer names the photo
    s = s.replace(/background-image:\s*url\([^)]*\)\s*;?/, "").replace(m[0], "none").replace(/;\s*$/, "");
    s = `${s ? s + ";" : ""}--bg:url(${q}${m[2]}${q});--bgw:${imageSet(q, w, m[2])}`;
    return `<${name}${pre} style="${s}"${post} data-lzbg>`;
  });
}

// <script> and <template> bodies are code, not markup: kept out of the rewrite
// <link rel="preload" as="image" href="x.jpg">: the page now shows x.webp, so
// the preload must name it too, or the browser fetches the JPEG for nothing.
function doPreloads(html, pageFile) {
  return html.replace(/<link rel="preload" as="image" href="([^"]+)"([^>]*)>/g, (tag, href, rest) => {
    const w = webpRef(href, pageFile);
    return w ? `<link rel="preload" as="image" type="image/webp" href="${w}"${rest}>` : tag;
  });
}

export function webpify(html, pageFile) {
  const stash = [];
  const work = html.replace(/<(script|template)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => `\u0000${stash.push(m) - 1}\u0000`);
  const lazyOk = /\/\*theme\*\//.test(html) && /tide(\.min)?\.js/.test(html);
  return doPreloads(doBackgrounds(doImages(work, pageFile), pageFile, lazyOk), pageFile).replace(/\u0000(\d+)\u0000/g, (_, i) => stash[i]);
}
