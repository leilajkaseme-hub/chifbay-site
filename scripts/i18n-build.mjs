/**
 * Chifbay — premium multilingual build.
 * Localizes the English site into /fr /de /pt /es /it using Claude (Opus 4.8)
 * as a native luxury copywriter + SEO localizer (idiomatic, persuasive, never
 * literal). Writes localized pages, fixes asset paths, updates canonical/lang,
 * the sitemap, and i18n-langs.json so the language switcher + auto-detection
 * activate automatically.
 *
 * Requires env: ANTHROPIC_API_KEY
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://chifbay.com";
if (!process.env.ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }
const client = new Anthropic();

const LANGS = {
  fr: "French (français de France)",
  de: "German (Deutsch)",
  pt: "European Portuguese (português de Portugal)",
  es: "Spanish (español de España)",
  it: "Italian (italiano)",
};
const PAGES = [
  "index.html","experiences.html","about.html","contact.html",
  "dolphin-whale-watching.html","sunset-cruise.html","hidden-coves-half-day.html",
  "coastal-discovery-full-day.html","blog.html",
];

const SYSTEM = (langName) => `You are a senior NATIVE COPYWRITER and SEO localizer for luxury travel brands. You localize the website of Chifbay — a premium PRIVATE BOAT CHARTER company in Funchal, Madeira (Portugal) — into ${langName}.

This is high-end MARKETING copy, not a manual. Rewrite the human-readable text so it reads as if a top native copywriter wrote it directly in ${langName}: idiomatic, elegant, emotionally compelling and persuasive — it should make the reader want to book a private boat right now. Adapt rhythm, idioms and tone to the culture. NEVER translate word-for-word; recreate the meaning beautifully. Keep it classy and concise — no clichés, no exclamation spam.

SEO (important): make it genuinely search-friendly in ${langName}. Localize the <title>, meta description, Open Graph / Twitter text, image alt attributes, and the keywords meta using the REAL phrases people search in that language (e.g. German: "Bootstour Madeira", "Delfine beobachten Madeira", "private Bootstour Funchal"; French: "excursion bateau Madère", "sortie dauphins Madère"). Titles must be compelling and keyword-led; meta descriptions must stay under ~155 characters and make people click.

You are given a full HTML document. Return the EXACT same HTML, translating ONLY the human-readable text. STRICT RULES:
- Do NOT modify any tag, attribute name, class, id, href, src, inline style, <script> code, or JSON-LD keys/@type. Translate JSON-LD string VALUES only (headline, name, description, and FAQ question/answer text).
- Do NOT translate or alter: "Chifbay"; place names (Funchal, Madeira, Cabo Girão, Câmara de Lobos, Ponta do Sol, Marina do Funchal, Ribeira Brava, Atlantic, Karnic, Mercury, Pico do Arieiro, Seixal); "poncha", "Moët"; any price/number/unit (€480, 9m, 300hp, 7 guests, 580m); phone numbers; emails; URLs; the language names inside .langmenu (English, Français, Deutsch, Português, Español, Italiano); "@chifbay".
- Keep every hreflang/alternate/canonical link, the language-switcher block, all <script> blocks and HTML comments EXACTLY as they are.
- Output ONLY the complete HTML document — no preamble, no code fences.`;

function fixPaths(html) {
  return html
    .replace(/href="peak\.css"/g, 'href="../peak.css"')
    .replace(/src="peak\.js"/g, 'src="../peak.js"')
    .replace(/href="assets\//g, 'href="../assets/')
    .replace(/src="assets\//g, 'src="../assets/')
    .replace(/url\('assets\//g, "url('../assets/");
}
function setMeta(html, lang, page) {
  const url = `${BASE}/${lang}/${page}`;
  html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}"/>`);
  if (/<meta property="og:url"/.test(html)) html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}"/>`);
  else html = html.replace(/<\/head>/, `<meta property="og:url" content="${url}"/>\n</head>`);
  if (!/<meta property="og:locale"/.test(html)) html = html.replace(/<\/head>/, `<meta property="og:locale" content="${lang}"/>\n</head>`);
  return html;
}

async function localize(html, langName) {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: SYSTEM(langName),
    messages: [{ role: "user", content: "Localize this page now:\n\n" + html }],
  });
  const m = await stream.finalMessage();
  let out = m.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  out = out.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
  const i = out.indexOf("<!DOCTYPE");
  if (i > 0) out = out.slice(i);
  if (!out.includes("</html>")) throw new Error("Incomplete translation output");
  return out;
}

function updateSitemap(codes) {
  const f = path.join(ROOT, "sitemap.xml");
  if (!fs.existsSync(f)) return;
  let xml = fs.readFileSync(f, "utf8");
  const urls = [];
  for (const c of codes) for (const pg of PAGES) {
    const loc = `${BASE}/${c}/${pg}`;
    if (!xml.includes(loc)) urls.push(`  <url><loc>${loc}</loc><changefreq>monthly</changefreq></url>`);
  }
  if (urls.length) xml = xml.replace("</urlset>", urls.join("\n") + "\n</urlset>");
  fs.writeFileSync(f, xml);
}

(async () => {
  const codes = Object.keys(LANGS);
  for (const [code, name] of Object.entries(LANGS)) {
    fs.mkdirSync(path.join(ROOT, code), { recursive: true });
    for (const page of PAGES) {
      const src = fs.readFileSync(path.join(ROOT, page), "utf8");
      let t = await localize(src, name);
      t = fixPaths(setMeta(t, code, page));
      fs.writeFileSync(path.join(ROOT, code, page), t);
      console.log(`  ${code}/${page}`);
    }
  }
  updateSitemap(codes);
  fs.writeFileSync(path.join(ROOT, "i18n-langs.json"), JSON.stringify(["en", ...codes]) + "\n");
  console.log("Localized:", ["en", ...codes].join(", "));
})().catch(err => { console.error("i18n build failed:", err); process.exit(1); });
