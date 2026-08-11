/**
 * Puts the three social accounts in the footer of every page.
 *
 *   node scripts/add-social-links.mjs           dry run
 *   node scripts/add-social-links.mjs --write   apply
 *
 * Instagram was already there as a line of text in the Contact column.
 * Facebook and TikTok were nowhere. All three now sit together as icons under
 * the logo, and the old text line is removed so the footer does not say
 * Instagram twice.
 *
 * Safe to run again: it strips any row it wrote before and writes a fresh one,
 * so this repairs rather than stacks up.
 *
 * Only the <footer> block is touched. index.html, about.html and contact.html
 * also mention Instagram in their body copy, and that must stay put.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const ACCOUNTS = [
  {
    name: "Instagram",
    handle: "@chifbay",
    url: "https://www.instagram.com/chifbay",
    // rounded square + lens + flash dot
    svg: '<rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.4"/><circle cx="12" cy="12" r="4.6"/><circle cx="17.9" cy="6.1" r="1.3" class="fdot"/>',
    outline: true,
  },
  {
    name: "Facebook",
    handle: "Chifbay",
    url: "https://www.facebook.com/profile.php?id=61593099213659",
    svg: '<path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22C18.34 21.24 22 17.08 22 12.06z"/>',
  },
  {
    name: "TikTok",
    handle: "@chifbay",
    url: "https://www.tiktok.com/@chifbay",
    svg: '<path d="M16.5 2h-3.2v13.2a2.6 2.6 0 1 1-2.1-2.55V9.4a5.8 5.8 0 1 0 5.3 5.78V8.9a7.1 7.1 0 0 0 4.1 1.31V7.02A4 4 0 0 1 16.5 2z"/>',
  },
];

const ROW =
  '        <div class="fsoc">\n' +
  ACCOUNTS.map(
    (a) =>
      `          <a href="${a.url}" target="_blank" rel="noopener" ` +
      `aria-label="Chifbay on ${a.name} (${a.handle})" title="${a.name} ${a.handle}">` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"${a.outline ? ' class="fsline"' : ""}>${a.svg}</svg></a>`
  ).join("\n") +
  "\n        </div>";

// The exact text link that used to carry Instagram in the Contact column.
const OLD_IG =
  /[ \t]*<a href="https:\/\/www\.instagram\.com\/chifbay" target="_blank" rel="noopener">Instagram @chifbay<\/a>\n/;

let changed = 0, skipped = 0, problems = 0;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "vendor") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const before = fs.readFileSync(file, "utf8");

  const fStart = before.indexOf("<footer>");
  const fEnd = before.indexOf("</footer>", fStart);
  if (fStart === -1 || fEnd === -1) { skipped++; continue; }

  const head = before.slice(0, fStart);
  const tail = before.slice(fEnd);
  let foot = before.slice(fStart, fEnd);

  // idempotent: drop a row written by an earlier run
  foot = foot.replace(/[ \t]*<div class="fsoc">[\s\S]*?<\/div>\n/, "");
  // the old text link, footer only
  foot = foot.replace(OLD_IG, "");

  // slot the icons in right after the blurb that closes the .fb2 block
  const fb2 = /(<div class="fb2">[\s\S]*?<\/p>)(\s*\n\s*<\/div>)/;
  if (!fb2.test(foot)) {
    console.log("  !!     " + rel + "   no .fb2 block in the footer — left alone");
    problems++;
    continue;
  }
  foot = foot.replace(fb2, (m, keep, close) => keep + "\n" + ROW + close);

  const after = head + foot + tail;
  if (after === before) { skipped++; continue; }
  console.log("  fix    " + rel);
  if (WRITE) fs.writeFileSync(file, after, "utf8");
  changed++;
}

console.log(`\n${changed} files ${WRITE ? "written" : "would change"}, ${skipped} already fine, ${problems} could not be done.`);
if (!WRITE) console.log("Dry run. Add --write to apply.");
