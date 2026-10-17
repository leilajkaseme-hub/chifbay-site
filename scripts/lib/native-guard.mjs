// native-guard.mjs: the checks that decide whether a native article written
// by the model may replace the old page (scripts/posts-i18n.mjs). Pure
// functions, tested by scripts/journal/test-native.mjs.
import fs from "node:fs";
import path from "node:path";

export const EDITABLE = [
  /<title>[\s\S]*?<\/title>/,
  /<meta name="description" content="[^"]*"\s*\/?>/,
  /<meta property="og:title" content="[^"]*"\s*\/?>/,
  /<meta property="og:description" content="[^"]*"\s*\/?>/,
  /<meta property="og:image:alt" content="[^"]*"\s*\/?>/,
  /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
  /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
  /<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/,
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
  /<div class="hbg"[^>]*>/,
  /<h1\b[\s\S]*?<\/h1>/,
  /<div class="artmeta[^"]*"[^>]*>[\s\S]*?<\/div>/,
  /<article\b[\s\S]*?<\/article>/,
];

/** The page with every editable part replaced by a marker: what must not move. */
export function skeleton(html) {
  let n = 0, out = html;
  for (const re of EDITABLE) out = out.replace(re, () => `§${n++}§`);
  return out.replace(/§\d+§/g, "§");
}
export const editableText = (html) => EDITABLE.flatMap((re) => html.match(re.global ? re : new RegExp(re.source)) || []).join("\n");
export const articleOf = (html) => (html.match(/<article\b[\s\S]*?<\/article>/) || [""])[0];
export const words = (frag) => frag.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
export const imgSrcs = (html) => [...articleOf(html).matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]).sort().join("|");
export const bgSrcs = (html) => [...html.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]).sort().join("|");

/** JSON-LD with its human text removed: keys, types, URLs, dates and images must not change. */
export function ldShape(html) {
  const TEXT = new Set(["headline", "description", "name", "text", "alternativeHeadline", "keywords", "articleSection", "caption", "inLanguage", "abstract"]);
  const strip = (v) => Array.isArray(v) ? v.map(strip)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !TEXT.has(k)).map(([k, x]) => [k, strip(x)]))
    : v;
  // a new article may have more or fewer FAQ questions: compare the shape of one
  const oneQuestion = (v) => Array.isArray(v) ? v.map(oneQuestion)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) =>
      [k, k === "mainEntity" && [].concat(v["@type"]).includes("FAQPage") && Array.isArray(x) ? x.slice(0, 1).map(oneQuestion) : oneQuestion(x)]))
    : v;
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.stringify(oneQuestion(strip(JSON.parse(m[1]))))).join("\n");
}

/** Internal links that point to nothing (path relative to the site root). */
export function deadLinks(ROOT, fragment, lang) {
  const dead = [];
  for (const [, href] of fragment.matchAll(/\bhref="([^"]+)"/g)) {
    let p = href;
    if (/^https:\/\/chifbay\.com/.test(p)) p = p.replace("https://chifbay.com", "");
    else if (p.startsWith("../../")) p = "/" + p.slice(6);
    else if (p.startsWith("../")) p = `/${lang}/` + p.slice(3);
    else if (!p.startsWith("/") || p.startsWith("//")) continue;     // external, mailto, tel, #anchor
    p = p.split(/[?#]/)[0].replace(/^\//, "");
    const cands = [p, `${p}.html`, path.join(p, "index.html")];
    if (!p || !cands.some((c) => fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile())) dead.push(href);
  }
  return dead;
}

