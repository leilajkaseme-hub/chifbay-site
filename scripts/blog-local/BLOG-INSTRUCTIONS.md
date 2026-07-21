# Task: generate and publish ONE new Chifbay Journal blog post, then stop.

You are running autonomously inside the `chifbay-site` repository (current directory).
Do everything below by yourself, commit, push, then output a one-line summary and stop.
Do NOT ask questions. Create exactly ONE post.

## Context
Chifbay = premium PRIVATE BOAT CHARTERS from Marina do Funchal, Madeira (Portugal):
the whole boat is yours (up to 7 guests). Three trips: Sunset Cruise, Hidden Coves
Half-Day, Coastal Discovery Full-Day. The blog ("Journal") posts are in `/posts/` and
are written in English.

## Steps
1. Run `date +%F` to get today's date (YYYY-MM-DD).
2. Read `posts/posts.json` — note the recent titles and categories so you do NOT repeat a topic.
3. Read `assets/blog-manifest.json` — pick ONE image whose `tags` fit your topic. Avoid the
   `heroImage` used by the 2 most recent posts.
4. Choose a topic in a category you have NOT used recently. Rotate across:
   - **Top 10** (ranked list: things to do / viewpoints / beaches / hidden gems / restaurants)
   - **Guide** (best time to visit, getting around, weather, what to pack, neighbourhoods)
   - **What's On** (Madeira news / events / seasonal — **use the WebSearch tool** for current facts)
   - **Experience** (sea caves, Cabo Girão, dolphins & whales, sunset at sea, snorkeling)
   - **Food & Drink** (poncha, espetada, Madeira wine, seafood, markets)
   - **Nature** (levadas, Pico do Arieiro, natural pools, north coast, Laurisilva)
5. If the topic is news/seasonal/"what's on", **use WebSearch** to ground claims in current facts.
6. Write a PREMIUM, genuinely useful article (~800–1100 words) optimised for **SEO + AI search**:
   a keyword-led title; H2 headings phrased as the real questions people ask; a direct factual
   answer in the first sentence under each heading; naturally weave in Chifbay once or twice with
   exactly ONE link to `../experiences.html`; no fluff. Also write 3–5 FAQ Q&A pairs.

## Output files
7. Create `posts/<slug>.html` by COPYING THE EXACT STRUCTURE of
   `posts/top-10-things-to-do-in-madeira.html` (same `<head>`, nav, hero, `<article>`, footer,
   and the two JSON-LD blocks: `BlogPosting` + `FAQPage`). Then replace, consistently:
   - `<title>`, meta description, canonical, og:title/description/image (all using the new slug/topic)
   - hero `background-image` + the hero image, the category badge text, the `<h1>`, the date, the
     reading-minutes, the `.lede`, and the full `<article>` body
   - both JSON-LD blocks (headline/description/image/datePublished/dateModified = today, and the FAQ)
   - Keep ALL paths exactly as in that file (`../assets/…`, `../peak.css`, `../experiences.html`, etc.)
     and keep the nav + footer identical to it (including the language switcher and the WhatsApp float).
   - `slug` = lowercase-hyphenated, no dates, ≤ 70 chars, unique vs existing posts.
8. Prepend a new object to the array in `posts/posts.json`:
   `{ "slug", "title", "category", "date" (today), "description", "heroImage", "heroAlt",
     "readingMinutes", "keywords": [6–10 phrases] }`  — keep the file valid JSON (2-space indent).
9. Add to `sitemap.xml`, immediately before `</urlset>`:
   `  <url><loc>https://chifbay.com/posts/<slug>.html</loc><changefreq>monthly</changefreq></url>`

## Publish
10. Do **NOT** commit or push. Leave the new files as they are — a later pipeline
    step generates AI images for this post, then commits and pushes everything together.
11. Print one line: `WRITTEN: <title> (<slug>)`.

## Rules
- Exactly ONE new post. Do not modify unrelated files or other languages.
- Factual and useful — no invented prices, no fake events. If unsure about a current fact, search or omit it.
- If `git push` is rejected, run `git pull --rebase` then push again.
