/**
 * Put the tracking tag on every page.
 *
 *   node scripts/add-tracking.mjs           list what would change
 *   node scripts/add-tracking.mjs --write   actually write it
 *   node scripts/add-tracking.mjs --remove  take the tag back off
 *
 * Safe to run again: a page that already has the tag is left alone. Run it
 * after any locale or blog rebuild — new pages come out of those scripts
 * without the tag.
 *
 * The src is absolute ("/track.js") on purpose. Pages live at three depths
 * (/, /fr/, /posts/) and apply-locale.mjs rewrites relative paths but never
 * absolute ones, so the tag survives a locale rebuild untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAG = '<script defer src="/track.js"></script>';
const MARKER = 'src="/track.js"';
const SKIP_DIRS = new Set(["node_modules", "vendor", ".git", "print"]);

const write = process.argv.includes("--write");
const remove = process.argv.includes("--remove");

function htmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...htmlFiles(path.join(dir, entry.name)));
    } else if (entry.name.endsWith(".html")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const files = htmlFiles(ROOT).sort();
let added = 0, dropped = 0, already = 0, noHead = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, "utf8");
  const has = html.includes(MARKER);

  if (remove) {
    if (!has) continue;
    const next = html.replace(/[ \t]*<script defer src="\/track\.js"><\/script>\n?/g, "");
    if (write) fs.writeFileSync(file, next);
    dropped++;
    console.log("  - " + rel);
    continue;
  }

  if (has) { already++; continue; }
  if (!/<\/head>/i.test(html)) {
    noHead++;
    console.warn("  ! no </head>, skipped: " + rel);
    continue;
  }

  // Last in the head, so the page's own scripts and styles are not delayed.
  const next = html.replace(/<\/head>/i, TAG + "\n</head>");
  if (write) fs.writeFileSync(file, next);
  added++;
  console.log("  + " + rel);
}

const verb = write ? "" : " (dry run, pass --write to apply)";
if (remove) console.log(`\nremoved from ${dropped} page(s)${verb}`);
else console.log(`\n${added} page(s) tagged, ${already} already had it, ${noHead} skipped${verb}`);
