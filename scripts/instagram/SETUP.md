# Instagram auto-posting — one-time free setup (~15 min, then hands-off)

This posts your `social/` photos to Instagram automatically, from the cloud, for **$0**,
using **Meta's official Instagram Graph API** — the sanctioned method. It does **not** use
your Instagram password and **cannot get your account banned**, unlike private-API
"auto-poster" bots. You only do this setup once.

## Why the official API (and not a password bot)
- **Free & permanent** — no fees, and it won't break when Instagram changes things.
- **No ban risk** — password bots and "free auto-post" apps violate Instagram's Terms and
  routinely get accounts shadowbanned or disabled. Not worth risking your real business account.
- **Still looks human** — the workflow posts on varied days at randomized times, and Claude
  writes a fresh, non-templated caption + hashtags every time. That's what actually helps reach.

## Requirements (all free)
1. An **Instagram Business or Creator** account (switch in the IG app:
   Settings → Account type → Switch to professional account). Free.
2. A **Facebook Page** connected to that Instagram account (IG app: Settings → Linked accounts,
   or link from the Page). Free.

## Get the two secrets
You need **IG_USER_ID** and a long-lived **IG_ACCESS_TOKEN**.

1. Go to **developers.facebook.com** → *My Apps* → *Create App* → type **Business**. Name it
   anything (e.g. "Chifbay Poster"). Free.
2. In the app, add the product **Instagram** (Instagram Graph API).
3. Open **Graph API Explorer** (developers.facebook.com/tools/explorer):
   - Pick your app, then **Generate Access Token** and grant these permissions:
     `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
     `pages_read_engagement`, `business_management`.
   - Run `GET me/accounts` → note your Page. Then run
     `GET {page-id}?fields=instagram_business_account` → the returned id is your **IG_USER_ID**.
4. **Make the token long-lived (60 days).** The short token from the Explorer expires in ~1 hour.
   Exchange it (replace the 3 values):
   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN
   ```
   Paste that in a browser; the `access_token` it returns is your **IG_ACCESS_TOKEN**
   (valid ~60 days — see "Keeping the token alive" below).

## Add them to GitHub (so the cloud can post)
Repo → **Settings → Secrets and variables → Actions → New repository secret**. Add:
- `IG_USER_ID` — the number from step 3
- `IG_ACCESS_TOKEN` — the long-lived token from step 4
- `CLAUDE_CODE_OAUTH_TOKEN` — you already have this from the auto-blog; reuse it.

## Test it
Repo → **Actions → "Chifbay Instagram — auto post" → Run workflow**. A manual run skips the
random delay and posts immediately. Check your Instagram — a photo + caption should appear,
and a small commit updates `scripts/instagram/state.json`.

## Change the schedule
Edit the `cron:` lines in `.github/workflows/instagram-auto.yml` (times are UTC). Fewer/more
slots, different days — your call. Default is 4×/week at randomized times.

## Keeping the token alive
The long-lived token lasts ~60 days. Two options:
- **Simple:** set a calendar reminder every ~50 days to regenerate it (repeat step 4) and update
  the `IG_ACCESS_TOKEN` secret. Takes 2 minutes.
- **Hands-off:** use a **System User** token in Meta Business Settings, which does not expire —
  see developers.facebook.com/docs/instagram-api → "System user access tokens".

## Notes / limits
- Instagram allows up to 50 API-published posts per 24h — far above this schedule.
- Only public JPEG/PNG URLs work as the image. Your `social/` pool already qualifies
  (`https://chifbay.com/social/chifbay-NN.jpg`).
- This posts single-image **feed posts**. Reels/Stories/carousels are possible via the same API
  later if you want them.
