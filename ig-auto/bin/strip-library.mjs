#!/usr/bin/env node
/**
 * Strip metadata from every photo in the library, in place.
 *
 *   node bin/strip-library.mjs --check    list what carries metadata
 *   node bin/strip-library.mjs
 *
 * Safe to run twice: a clean file is left byte for byte alone.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config, SITE_ROOT } from "../lib/queue.mjs";
import { stripMetadata } from "../lib/strip-metadata.mjs";
import sharp from "sharp";

const CHECK = process.argv.includes("--check");
const IMAGE = /\.(jpe?g|png|webp)$/i;
const dirs = [...(config.library_dirs || []), ...(config.story_dirs || [])];

let touched = 0, saved = 0, same = 0, broken = 0;
for (const dir of dirs) {
  const abs = join(SITE_ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs).filter((x) => IMAGE.test(x))) {
    const p = join(abs, f);
    const before = readFileSync(p);
    const after = stripMetadata(before);
    if (after.length === before.length) { same++; continue; }

    // Never write a file that stopped being a readable image.
    try {
      const a = await sharp(before).metadata();
      const b = await sharp(after).metadata();
      if (a.width !== b.width || a.height !== b.height) throw new Error("size changed");
    } catch (err) {
      console.log(`  SKIPPED ${f}: ${err.message}`);
      broken++;
      continue;
    }

    const cut = before.length - after.length;
    console.log(`  ${CHECK ? "would strip" : "stripped"} ${f}  (${cut} bytes)`);
    if (!CHECK) writeFileSync(p, after);
    touched++; saved += cut;
  }
}
console.log(`\n${touched} file(s) ${CHECK ? "carry" : "cleaned of"} metadata, ` +
            `${(saved / 1024).toFixed(1)} KB, ${same} already clean` +
            (broken ? `, ${broken} skipped as unreadable` : ""));
