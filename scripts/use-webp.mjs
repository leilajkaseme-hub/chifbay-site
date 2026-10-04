#!/usr/bin/env node
// use-webp.mjs: switch every page to the WebP photos made by make-webp.py.
//
//   python3 scripts/make-webp.py && node scripts/use-webp.mjs           write
//   node scripts/use-webp.mjs --check                                    count, write nothing
//
// The rewrite itself is scripts/lib/webp.mjs (read it for the forms it uses).
// Safe to run again: a page already switched comes back byte for byte.
// Run it after anything that writes new photo markup: the Journal robot
// (blog-auto.yml does), the reviews build, or a page edited by hand.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webpify } from "./lib/webp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const SKIP = new Set([".git", "node_modules", "ig", "ig-auto", "social", "social-drive", "social-iphone", "story-9x16", "zz-test", "vendor", "print"]);

function pages(dir = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...pages(rel));
    else if (e.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

let changed = 0;
for (const rel of pages()) {
  const file = path.join(ROOT, rel);
  const before = fs.readFileSync(file, "utf8");
  const after = webpify(before, file);
  if (after === before) continue;
  changed++;
  if (!CHECK) fs.writeFileSync(file, after);
}
console.log(`${changed} page(s) ${CHECK ? "would change" : "switched to WebP"}.`);
