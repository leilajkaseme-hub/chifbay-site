/**
 * Adds the light/dark machinery to every page.
 *
 *   node scripts/add-theme.mjs           dry run
 *   node scripts/add-theme.mjs --write   apply
 *
 * Two things go in:
 *
 * 1. A tiny BLOCKING script at the very top of <head>. It has to be inline and
 *    it has to block: an external or deferred file runs after the first paint,
 *    so a light-theme visitor would see a flash of the dark site on every
 *    single page load. It is ~200 bytes, which is cheaper than that flash.
 *
 * 2. The toggle itself, under the social icons in the footer.
 *
 * Dark stays the default. The site's whole identity is the navy, so a visitor
 * whose laptop is in light mode still gets the dark site until they ask for
 * otherwise — the choice is then remembered. Change DEFAULT below to follow
 * the operating system instead.
 *
 * Safe to run again: it strips what it wrote before and writes it fresh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

const HEAD =
  `<script>/*theme*/(function(){try{var t=localStorage.getItem('cb-theme');` +
  `if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t)}` +
  `catch(e){document.documentElement.setAttribute('data-theme','dark')}})();</script>`;

const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/>' +
  '<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 13.2A9 9 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2z"/></svg>';

const TOGGLE =
  '        <div class="themetog" role="group" aria-label="Colour theme">\n' +
  `          <button type="button" data-theme="light" aria-pressed="false">${SUN}Light</button>\n` +
  `          <button type="button" data-theme="dark" aria-pressed="true">${MOON}Dark</button>\n` +
  "        </div>";

let head = 0, foot = 0, skipped = 0;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "vendor"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  const before = fs.readFileSync(file, "utf8");
  let s = before;

  // idempotent
  s = s.replace(/<script>\/\*theme\*\/[\s\S]*?<\/script>\n?/g, "");
  s = s.replace(/[ \t]*<div class="themetog"[\s\S]*?<\/div>\n/g, "");

  // 1. the no-flash snippet, first thing after <head>
  const h = s.indexOf("<head>");
  if (h === -1) { console.log("  skip   " + rel + "  (no <head>)"); skipped++; continue; }
  s = s.slice(0, h + 6) + "\n" + HEAD + s.slice(h + 6);
  head++;

  // 2. the toggle, right after the footer social icons
  const soc = /([ \t]*<div class="fsoc">[\s\S]*?<\/div>\n)/;
  if (soc.test(s)) { s = s.replace(soc, (m) => m + TOGGLE + "\n"); foot++; }

  if (s === before) { skipped++; continue; }
  if (WRITE) fs.writeFileSync(file, s, "utf8");
}

console.log(`\n${head} pages got the no-flash script, ${foot} got the footer toggle, ${skipped} skipped.`);
if (!WRITE) console.log("Dry run. Add --write to apply.");
