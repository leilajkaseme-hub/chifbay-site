# Task: publish ONE Instagram post for Chifbay, then stop.

You are running autonomously inside the `chifbay-site` repository (current directory).
Do everything below yourself, then output a one-line summary and stop.
Do NOT ask questions. Create exactly ONE post. Do NOT touch unrelated files.

## Context
Chifbay = premium PRIVATE BOAT CHARTERS from Marina do Funchal, Madeira (Portugal):
the whole boat is yours (up to 7 guests). Three trips: Sunset Cruise, Hidden Coves
Half-Day, Coastal Discovery Full-Day. Instagram audience = travellers planning a
Madeira trip. Voice: warm, vivid, effortless — like a local friend, never salesy or
templated. Booking is via the website / WhatsApp.

## Steps
1. Read `scripts/instagram/state.json` — the `posted` array lists photo filenames already
   used. Read `social/manifest.json` — it has 77 public photo URLs.
2. Pick ONE photo whose filename is NOT in `posted`. Prefer variety vs the last few used.
   If every photo is already in `posted`, reset `posted` to `[]` and pick any photo.
   The public URL is `https://chifbay.com/social/<filename>` (e.g. chifbay-23.jpg).
3. Write ONE caption that feels HUMAN, not automated — vary it every time so no two posts
   read alike:
   - Open with a specific, sensory hook (a detail about the light, the water, a cove, the
     quiet) — NOT "Book now" and NOT the same opener as recent posts.
   - 1–3 short lines. Natural line breaks. At most one tasteful emoji or two — sometimes none.
   - A soft, varied call to action (e.g. "DM us to reserve your day on the water" /
     "Link in bio to plan yours" / "WhatsApp us for dates") — rotate the wording.
   - 8–15 hashtags on the LAST line, mixing broad + local: e.g. #Madeira #Funchal
     #VisitMadeira #boattrip #privatecharter #sunsetcruise #dolphins #atlantic #islandlife
     #traveltok #hiddencoves #madeiraisland — vary the set to fit the photo (sunset vs caves
     vs dolphins vs coastline). Do not reuse the exact same hashtag block every time.
   - Keep total under 2,200 characters. No invented prices, no fake reviews, no fake urgency.
4. Write the caption to `scripts/instagram/caption.txt` (overwrite it).

## Publish
5. Run:
   `node scripts/instagram/post-to-instagram.mjs --image-url "https://chifbay.com/social/<filename>" --caption-file scripts/instagram/caption.txt`
   The script uses the IG_USER_ID and IG_ACCESS_TOKEN env vars (already set by the workflow).
6. Only if the script prints `PUBLISHED:` — update `scripts/instagram/state.json`: append the
   filename to `posted`, set `lastCaption` to the caption's first line, keep valid JSON.
   Then commit and push:
   `git add scripts/instagram/state.json scripts/instagram/caption.txt`
   `git commit -m "IG post: <photo> (<first few words of caption>)"`
   `git push`  (if rejected: `git pull --rebase` then push again)
7. Print one line: `POSTED: <filename> — <first line of caption>`.
   If the script did NOT print `PUBLISHED:`, print `FAILED: <the error>` and do NOT commit state.

## Rules
- Exactly ONE post. Never post the same photo twice until the pool resets.
- Captions must be genuinely varied and human — this is the whole point. No boilerplate.
- Factual only. If unsure about a claim, leave it out.
