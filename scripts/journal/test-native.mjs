// test-native.mjs: the native article checks refuse what they must refuse.
//   node scripts/journal/test-native.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { skeleton, editableText, articleOf, words, imgSrcs, ldShape, deadLinks } from "../lib/native-guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const page = fs.readFileSync(path.join(ROOT, "de/posts/top-10-villages-in-madeira.html"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`  ${c ? "ok  " : "FAIL"} ${m}`); };

const art = articleOf(page);
const newArt = art.replace(/<h2>[^<]*<\/h2>/g, "<h2>Ein neuer Abschnitt</h2>").replace(/<p>/, "<p>Ganz neuer Text, auf Deutsch geschrieben. ");
const rewritten = page.replace(art, newArt).replace(/<title>[^<]*<\/title>/, "<title>Madeira Sehenswürdigkeiten: die schönsten Dörfer</title>")
  .replace(/<h1([^>]*)>[^<]*<\/h1>/, "<h1$1>Madeiras Dörfer</h1>");
ok(skeleton(rewritten) === skeleton(page), "a new article, title and h1 keep the rest of the page the same");
ok(skeleton(page.replace('<nav id="nav">', '<nav id="nav" data-x>')) !== skeleton(page), "a change in the menu is caught");
ok(skeleton(page.replace("</footer>", "<p>x</p></footer>")) !== skeleton(page), "a change in the footer is caught");
ok(skeleton(page.replace('class="artcta rv"', 'class="artcta"')) !== skeleton(page), "a change in the call to action is caught");
ok(/[—–]/.test(editableText(page.replace("</h1>", " — x</h1>"))), "a long dash in the edited parts is seen");
ok(!/[—–]/.test(editableText(page.replace(/<article\b[\s\S]*?<\/article>/, "<article></article>").replace(/<title>[^<]*<\/title>|<meta (?:name|property)="[^"]*" content="[^"]*"\s*\/?>|<script type="application\/ld\+json">[\s\S]*?<\/script>|<div class="artmeta[^"]*"[^>]*>[\s\S]*?<\/div>/g, ""))), "dashes outside the edited parts (menu logo alt) are not counted");
ok(imgSrcs(rewritten) === imgSrcs(page), "same photos pass");
ok(imgSrcs(page.replace(/inline-2\.jpg/, "inline-9.jpg")) !== imgSrcs(page), "a swapped photo is caught");
ok(ldShape(rewritten) === ldShape(page), "JSON-LD text may change");
const ldUrl = page.replace(/"mainEntityOfPage":"[^"]*"/, '"mainEntityOfPage":"https://example.com/"');
ok(ldUrl === page || ldShape(ldUrl) !== ldShape(page), "a changed URL in JSON-LD is caught");
let broken = false; try { ldShape(page.replace(/("@context")/, "$1,,")); } catch { broken = true; }
ok(broken, "JSON-LD that does not parse is caught");
ok(words(newArt) > 300, "word count works");
ok(deadLinks(ROOT, '<a href="/de/sunset-cruise">x</a><a href="../../de/experiences">y</a><a href="https://wa.me/1">z</a>', "de").length === 0, "real links pass, external links are ignored");
ok(deadLinks(ROOT, '<a href="/de/no-such-page">x</a>', "de").length === 1, "a link to nothing is caught");
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
