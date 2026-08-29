#!/usr/bin/env node
// check-library.mjs — refuse a photo library that CI cannot see.
//
// This exists because of a fault that hid for weeks. config.library_dirs held
// "../klook-photos" and "../clickandboat-sunset-photos", which sit next to the
// git repo, not inside it. Everything looked right on the laptop: 87 files, 82
// distinct photos, a preview that made sense. GitHub Actions only ever has what
// was pushed, so it saw 77 and five real photos of the boat never went out.
// Nothing failed. No log said anything. The only symptom was a number in a
// report nobody was comparing across two machines.
//
// Fixed by committing those five into social/ as onboard-*.jpg and deleting
// both entries. The two folders held the SAME five files under different names,
// so five photos, not ten, were ever missing.
//
// So the rule is now checked, not remembered: every library folder must be
// inside the repo, and it must actually contain photos.
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { config, SITE_ROOT } from "../lib/queue.mjs";
import { libraryFiles } from "../lib/image.mjs";

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const problems = [];

for (const dir of config.library_dirs) {
  const abs = resolve(SITE_ROOT, dir);
  const rel = relative(SITE_ROOT, abs);

  if (rel.startsWith("..")) {
    problems.push(
      `"${dir}" is outside the repo (${abs}).\n` +
      `    GitHub Actions only sees what is pushed, so those photos would never\n` +
      `    post. Move them into social/ and drop this entry from config.json.`,
    );
    continue;
  }
  if (!existsSync(abs)) {
    problems.push(`"${dir}" does not exist (${abs}).`);
    continue;
  }
  if (!readdirSync(abs).some((f) => IMAGE_RE.test(f))) {
    problems.push(`"${dir}" holds no .jpg/.png/.webp — it contributes nothing.`);
  }
}

const found = libraryFiles().length;
if (!found) problems.push("the library is empty — there is nothing to post.");

if (problems.length) {
  console.error("The photo library is not usable:\n");
  for (const p of problems) console.error(`  - ${p}\n`);
  process.exit(1);
}

console.log(`library OK — ${found} photo file(s) across ${config.library_dirs.join(", ")}`);
