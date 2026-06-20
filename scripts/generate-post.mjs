/**
 * Chifbay — automated blog post generator.
 * Calls Claude (Opus 4.8) with web search + structured output, picks an image
 * from the album manifest, writes a new post HTML page, and updates
 * posts/posts.json + sitemap.xml. Run by .github/workflows/blog.yml on a schedule.
 *
 * Requires env: ANTHROPIC_API_KEY
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://chifbay.com";
const POSTS_JSON = path.join(ROOT, "posts", "posts.json");
const MANIFEST = path.join(ROOT, "assets", "blog-manifest.json");
const SITEMAP = path.join(ROOT, "sitemap.xml");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY — set it as a GitHub Actions secret.");
  process.exit(1);
}
const client = new Anthropic();

const CATEGORIES = [
  "Top 10",        // ranked list: things to do / viewpoints / beaches / restaurants / hidden gems
  "Guide",         // practical: best time to visit, getting around, weather, what to pack, neighbourhoods
  "What's On",     // current Madeira news, events, seasonal happenings — USE WEB SEARCH for fresh facts
  "Experience",    // deep-dive: dolphins & whales, sea caves, Cabo Girão, sunset at sea, snorkeling
  "Food & Drink",  // poncha, espetada, Madeira wine, seafood, markets
  "Nature",        // levadas, Pico do Arieiro, Laurisilva, natural pools, north coast
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function jstr(s){ return JSON.stringify(String(s)); }

const posts = JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
const images = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const recentCats = posts.slice(0, 2).map(p => p.category);
const category = CATEGORIES.find(c => !recentCats.includes(c)) || CATEGORIES[posts.length % CATEGORIES.length];
const recentTitles = posts.slice(0, 10).map(p => p.title);
const recentImages = posts.slice(0, 4).map(p => p.heroImage);
const imageChoices = images.map(i => ({ file: i.file, alt: i.alt, tags: i.tags }));

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title","slug","metaDescription","keywords","heroImage","heroAlt","lede","bodyHtml","faq","readingMinutes"],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    metaDescription: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    heroImage: { type: "string", enum: images.map(i => i.file) },
    heroAlt: { type: "string" },
    lede: { type: "string" },
    bodyHtml: { type: "string" },
    faq: { type: "array", items: { type: "object", additionalProperties:false, required:["q","a"], properties:{ q:{type:"string"}, a:{type:"string"} } } },
    readingMinutes: { type: "integer" }
  }
};

const SYSTEM = `You are the writer and SEO strategist for Chifbay, a private boat-charter company in Madeira, Portugal, departing Marina do Funchal. Chifbay runs small private boat trips (the whole boat is yours, up to 7 guests) — dolphin & whale watching, sunset cruises, hidden coves with snorkeling, and full-day coastal discovery past Câmara de Lobos and Cabo Girão.

Write a single, genuinely useful blog article about Madeira for the Chifbay Journal.

RULES:
- Optimise for BOTH Google SEO and AI/LLM answer engines (ChatGPT, Perplexity, Google AI). That means: a clear, search-intent title; H2 headings phrased as the questions people actually ask; direct, factual answers in the first sentence under each heading; real entities and place names; no fluff or filler.
- Naturally weave in Chifbay 1–2 times where it genuinely fits (e.g. seeing the coast/dolphins/sunset from a private boat) and include exactly ONE internal link to the experiences page using href="../experiences.html". Do not over-sell — be helpful first.
- Be accurate. If the topic involves current events, prices, openings, seasons or "what's on", USE THE WEB SEARCH TOOL to ground claims in up-to-date facts.
- bodyHtml: clean semantic HTML only — <h2>, <h3>, <p>, <ul>/<li>, <strong>, <blockquote>, and <a>. NO <h1>, NO inline styles, NO <img>, NO markdown. 700–1100 words.
- lede: one or two italic-worthy sentences that hook the reader (plain text, no tags).
- slug: lowercase, hyphenated, <=70 chars, no dates.
- metaDescription: <=155 chars, compelling, includes the main keyword.
- keywords: 6–10 realistic search phrases.
- heroImage: choose the BEST-fitting file from the provided list (must match the article topic).
- faq: 3–5 question/answer pairs that real travellers ask, answers 1–3 sentences, factual.

Return ONLY the structured object.`;

const userMsg = `Write today's article.
Category to write in this time: ${category}.
Avoid repeating these recent titles/topics: ${JSON.stringify(recentTitles)}.
Prefer a hero image NOT in this recent set if a good match exists: ${JSON.stringify(recentImages)}.
Available images (choose heroImage by "file"): ${JSON.stringify(imageChoices)}.
Today's date: ${todayISO()}.`;

async function generate() {
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: userMsg }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(text);
}

function renderPost(d, dateISO) {
  const url = `${BASE}/posts/${d.slug}.html`;
  const heroImg = images.find(i => i.file === d.heroImage) || images[0];
  const faqJson = d.faq.map(f => `{"@type":"Question","name":${jstr(f.q)},"acceptedAnswer":{"@type":"Answer","text":${jstr(f.a)}}}`).join(",");
  const faqHtml = d.faq.map(f => `<details class="rv"><summary>${esc(f.q)}<span class="fi">+</span></summary><p class="fb">${esc(f.a)}</p></details>`).join("\n      ");
  const dateNice = new Date(dateISO + "T00:00:00").toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(d.title)} | Chifbay</title>
<meta name="description" content="${esc(d.metaDescription)}">
<meta name="keywords" content="${esc(d.keywords.join(", "))}">
<link rel="canonical" href="${url}"/>
<meta name="robots" content="index,follow"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${esc(d.title)}"/>
<meta property="og:description" content="${esc(d.metaDescription)}"/>
<meta property="og:image" content="${BASE}/${heroImg.file}"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="../assets/favicon.ico" sizes="any"/>
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="../peak.css"/>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BlogPosting","headline":${jstr(d.title)},"description":${jstr(d.metaDescription)},"image":"${BASE}/${heroImg.file}","datePublished":"${dateISO}","dateModified":"${dateISO}","author":{"@type":"Organization","name":"Chifbay"},"publisher":{"@type":"Organization","name":"Chifbay","logo":{"@type":"ImageObject","url":"${BASE}/assets/logo-white.png"}},"mainEntityOfPage":"${url}"}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${faqJson}]}
</script>
</head>
<body>

<nav id="nav"><div class="wrap ni">
  <a class="logo" href="../index.html"><img src="../assets/logo-white.png" alt="Chifbay"></a>
  <nav class="nl">
    <a href="../index.html">Home</a>
    <a href="../experiences.html">Experiences</a>
    <a href="../about.html">The Story</a>
    <a href="../blog.html" class="active">Journal</a>
    <a href="../contact.html">Contact</a>
  </nav>
  <div style="display:flex;align-items:center">
    <a class="nc" href="../experiences.html">Book your boat</a>
    <button class="navtoggle" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</div></nav>

<header class="hero sub">
  <div class="hbg" style="background-image:url('../${heroImg.file}')"></div>
  <div class="hov"></div>
  <div class="wrap hc">
    <div class="hbadge rv in">Journal · ${esc(category)}</div>
    <h1 class="rv in" style="font-size:clamp(2.2rem,5vw,4rem);max-width:22ch">${esc(d.title)}</h1>
    <div class="artmeta rv in d1"><span>${dateNice}</span><span>${d.readingMinutes} min read</span><span>Funchal · Madeira</span></div>
  </div>
</header>

<section class="pad">
  <div class="wrap">
    <article class="article rv">
      <p class="lede">${esc(d.lede)}</p>
      ${d.bodyHtml}
    </article>

    <div class="artcta rv">
      <div class="eyebrow gold" style="justify-content:center;margin-bottom:12px">Your group only</div>
      <h3>See Madeira from the water with Chifbay</h3>
      <p>Private boat trips from Funchal — dolphins, hidden coves, Cabo Girão and golden-hour sunsets. The boat is yours alone.</p>
      <a class="btn btn-p btn-lg" href="../experiences.html">Explore the experiences →</a>
    </div>
  </div>
</section>

<section class="pad" style="padding-top:0">
  <div class="wrap">
    <div class="center rv"><div class="eyebrow">Good to know</div><h2>Questions, answered</h2></div>
    <div class="faq">
      ${faqHtml}
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="fg">
      <div class="fb2">
        <div class="logo" style="margin-bottom:16px"><img src="../assets/logo-white.png" alt="Chifbay" style="height:42px;width:auto;display:block"></div>
        <p>Private boat tours from Funchal, Madeira. Snorkeling in hidden coves, Cabo Girão and luxury sunset cruises — your group only, always.</p>
      </div>
      <div class="fc"><h4>Explore</h4>
        <a href="../experiences.html">Experiences</a>
        <a href="../about.html">The Story</a>
        <a href="../blog.html">Journal</a>
        <a href="../contact.html">Contact</a>
      </div>
      <div class="fc"><h4>Contact</h4>
        <a href="tel:+351937200320">+351 937 200 320</a>
        <a href="mailto:hello@chifbay.com">hello@chifbay.com</a>
        <a href="https://www.instagram.com/chifbay" target="_blank" rel="noopener">Instagram @chifbay</a>
      </div>
    </div>
    <div class="fbot">
      <span class="fcr">© <span id="yr">${dateISO.slice(0,4)}</span> Chifbay · Madeira, Portugal</span>
      <span class="fcr">Funchal Marina · Built for the Atlantic</span>
    </div>
  </div>
</footer>

<a class="wa" href="https://wa.me/351937200320" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.82 9.82 0 001.523 5.26l-.999 3.648 3.965-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg></a>

<script src="../peak.js"></script>
</body>
</html>`;
}

function addToSitemap(slug) {
  if (!fs.existsSync(SITEMAP)) return;
  let xml = fs.readFileSync(SITEMAP, "utf8");
  const loc = `${BASE}/posts/${slug}.html`;
  if (xml.includes(loc)) return;
  xml = xml.replace("</urlset>", `  <url><loc>${loc}</loc><changefreq>monthly</changefreq></url>\n</urlset>`);
  fs.writeFileSync(SITEMAP, xml);
}

(async () => {
  const d = await generate();
  // safety: ensure a unique slug
  let slug = d.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  if (posts.some(p => p.slug === slug)) slug = `${slug}-${todayISO()}`;
  d.slug = slug;

  const dateISO = todayISO();
  fs.writeFileSync(path.join(ROOT, "posts", `${slug}.html`), renderPost(d, dateISO));

  const heroImg = images.find(i => i.file === d.heroImage) || images[0];
  posts.unshift({
    slug, title: d.title, category, date: dateISO,
    description: d.metaDescription, heroImage: heroImg.file, heroAlt: d.heroAlt || heroImg.alt,
    readingMinutes: d.readingMinutes, keywords: d.keywords,
  });
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2) + "\n");
  addToSitemap(slug);

  console.log(`Published: ${d.title}`);
  console.log(`  posts/${slug}.html  ·  ${category}  ·  hero ${heroImg.file}`);
})().catch(err => { console.error("Generation failed:", err); process.exit(1); });
