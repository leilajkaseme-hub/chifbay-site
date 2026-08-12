# ig-auto — a daily post and a daily story for @chifbay

Runs in GitHub's cloud on a schedule. **Your computer can be off.**

**Free to run, with no monthly limit and nothing that expires.**

---

## How it works

```
05:00 UTC   top up      build both queues ahead  ->  queue/ + ig/  ->  git push
10:00 UTC   post        oldest feed item         ->  Meta API      ->  Instagram
17:00 UTC   story       oldest story item        ->  Meta API      ->  Instagram
            (each + 0-90 min random wait)
Mon + Thu   heartbeat   "did anything go out?"   ->  alert if it quietly stopped
```

Feed and story have separate queues and separate daily guards, so one of each
goes out per day and a story failing never costs you the feed post.

Split by how much each may fail:

- **Top-up** is allowed to fail. It fills the queues to 12 feed posts and 10
  stories. If it breaks for a week, nothing bad happens.
- **Post** and **story** must not fail. They take the oldest item and publish it,
  using **no npm packages at all** — only Node's standard library — so there is
  almost nothing in them that can break.

That is the whole reliability idea: the part that must work is tiny, and it has
a 12-day buffer in front of it.

---

## Why it costs nothing, and why nothing expires

Posts go **straight to Meta's own API**. No third party in the middle, so there
is no monthly operation budget, no plan to outgrow, and no company that can
change its pricing. Publishing to your own Instagram from your own app needs no
app review and no approval.

The usual reason people avoid going direct is the 60-day access token. That is
solved once, at setup, instead of in code: the token is a Business Manager
**System User token, issued with no expiry**. There is nothing to refresh, so
there is no refresh job that can fail silently. `bin/token-check.mjs` warns if
that token is ever invalid, short-lived, or missing a permission.

### Why not Make

Make was the first build, and `lib/publish.mjs` still has the `make-webhook`
transport plus an importable blueprint. Two reasons it lost:

- **Make cannot post stories at all.** Its Instagram app has no create-story
  module — checked the full list, deprecated ones included. Only `ListUserStories`,
  which is read-only.
- Make's free plan shares **one pool of 1,000 operations a month across every
  scenario in the account**. Posting needs about 93; the problem is the sharing.
  The "SafePay Studio Waitlist" scenario has already used 986 on its own, which
  is why that organisation is paused. An unrelated busy webhook can starve the
  posting job, and the first sign would be a missing post.

> One thing no method avoids: Instagram requires the account to be a **Business
> or Creator account linked to a Facebook Page**. That is an Instagram rule, not
> an API-key rule. @chifbay is already a Business account.

### What a story can and cannot be

A story published through the API is **the picture and nothing else**. Meta does
not let an app add text overlays, stickers, polls, music or link stickers —
those exist only in the phone app. So stories here are chosen for images that
stand on their own, cropped to 9:16.

## Where the pictures come from

**Real photos first.** 87 of them across `social/`, `klook-photos/` and
`clickandboat-sunset-photos/`. A real photo of the real boat beats a generated
one every time, and there are enough for three months without a repeat.

**AI only for scenery** — ocean, cliffs, sunsets, dolphins. Free, via
Pollinations, no key. Set `"ai_provider": "openai"` in `config.json` and add an
`OPENAI_API_KEY` secret if you want better quality.

**The AI is never asked to draw the boat.** It gets it wrong every time. In
testing it duplicated the gold `Chifbay` script on the hull, and Gemini refused
the subject outright. A wrong boat on a real business account is worse than no
post. Angles that show the boat, the crew or guests are marked
`"ai_prompt": null` in `brand.json` and can only come from real photos.

Images are cropped to where they are going: **1080x1350** (4:5) for the feed,
the ratio that takes the most space there and sits safely inside Meta's accepted
4:5-1.91:1 range, and **1080x1920** (9:16) for stories, the full phone screen.
A tall or panoramic original can never be rejected.

The same source photo is never used for both. The 9:16 crop has a different
hash from the 4:5 one, so the cooldown matches on the source file, and it covers
what is queued as well as what has been posted.

---

## Where the words come from

Claude Code, on your subscription OAuth token — the same way `blog-auto.yml`
already works. No Anthropic API key, no per-post cost.

**It looks at the actual photo before writing.** This matters: the first version
picked a subject first and captioned a photo of guests at the rail with "the
dolphins came to us this morning". Now the picture is made first, the model
reads it, and it can overrule the suggested subject if the photo is really about
something else.

Brand rules live in `brand.json`. Hard checks in `lib/caption.mjs` reject any
caption that mentions a price, claims more than five guests, guarantees
wildlife, or puts hashtags in the body. Three tries, then a plain template takes
over — a hard-to-write caption must never be the reason a day gets skipped.

---

## Not getting throttled

Nothing here logs into Instagram as you. No browser automation, no phone
automation, no unofficial API. Those are what actually get accounts limited, and
they are the reason `ig-phone-poster` is not used for this. Everything goes
through Meta's sanctioned publishing path.

On top of that:

- **Random posting time.** The feed job fires at 10:00 UTC and the story job at
  17:00 UTC, and each then waits 0-90 minutes. Posting at exactly the same
  second every day is the most obviously automated thing an account can do.
- **Hashtags rotate.** 5-8 per post, chosen least-recently-used across four
  pools plus tags specific to what is in the photo. The set is never identical
  to any of the last 10 posts. Big blocks of the same 30 tags are the classic
  reach killer. `brand.json` also has a ban list of engagement-bait tags.
- **Captions cannot repeat.** Every new caption is compared against the last 30.
  Too similar, and it gets rewritten.
- **Subjects cycle.** All 12 angles run before any of them comes back.
- **No photo twice, ever.** Every posted image's sha256 is checked before
  publishing. Source files also get a 120-day cooldown.
- **One feed post and one story a day, never a burst.** Enforced by separate
  daily guards, not by luck.

It does **not** randomly skip days. Instagram does not punish consistency — it
punishes bursts and repetition. You asked for every day, so it posts every day.

---

## Why it never double-posts

Same five safeguards as `youtube-auto`:

- **Move-on-success** — the item leaves `queue/` the instant Instagram accepts
  it, and the code aborts loudly if the move did not happen.
- **Daily guard** (`state.json`) — records the last posted date in Madeira time.
  A re-run on the same day is a no-op, not a second post.
- **Lock file** — two overlapping runs cannot both publish. Anything older than
  an hour counts as a crashed run, so a killed job cannot block the queue.
- **Ledger** (`ledger.jsonl`) — append-only record of every post and every
  failure.
- **Image hash** — the same picture can never go out twice even if it re-enters
  the queue by another route.

A failed post leaves the item in the queue. Tomorrow picks it up.

---

## Setup

One-time, about 15 minutes. Nothing here costs money.

### 1. Create the app
[developers.facebook.com](https://developers.facebook.com/apps) → **Create App**
→ type **Business** → name it `chifbay-posting`.

Then **Add product → Instagram → Set up**. You do not submit anything for
review: an app publishing to its own Instagram account needs no approval.

### 2. Create a System User token that never expires

This is the step that removes the 60-day problem. Do not skip it, and do not use
the token from the Graph API Explorer — that one is short-lived.

[business.facebook.com/settings](https://business.facebook.com/settings) →
**Users → System users → Add**

1. Name it `chifbay-automation`, role **Admin**
2. **Add assets** → **Apps** → pick `chifbay-posting` → Full control
3. **Add assets** → **Pages** → pick the Chifbay Page → Full control
4. **Generate new token** → app `chifbay-posting`
5. **Token expiration: Never** ← the whole point
6. Tick these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
7. Copy the token. **It is shown once.**

### 3. Find the account id

```bash
cd ig-auto
IG_ACCESS_TOKEN=paste_the_token node bin/whoami.mjs
```

It prints the Page, the linked Instagram handle and the `IG_USER_ID`. That id is
not the number in your profile URL — it is the Instagram Business Account id
hanging off the Page, which Meta's own screens bury.

### 4. GitHub secrets
Repo → Settings → Secrets and variables → Actions:

| Secret | What it is |
| --- | --- |
| `IG_ACCESS_TOKEN` | the System User token from step 2 |
| `IG_USER_ID` | the id from step 3 |
| `CLAUDE_CODE_OAUTH_TOKEN` | already set — used by the blog job |
| `OPENAI_API_KEY` | optional, only for better AI scenery |

### 5. Prove it works, in this order

```bash
cd ig-auto && IG_ACCESS_TOKEN=… IG_USER_ID=… node bin/token-check.mjs
```
Should print `expires never` and `all good`.

Then in the Actions tab, one at a time:

1. **top up the queue** — wait for the push, read `ig-auto/queue/`, check you
   like the posts
2. **daily post** — one real feed post goes out, log prints a `MEDIA_ID`
3. **daily story** — one real story goes out
4. **heartbeat** — should say `all good`

After that the schedule takes over on its own.

## Day to day

```bash
cd ig-auto
npm install          # once
node bin/status.mjs  # queue depth, last post, failure count
```

**To review or change what goes out:** the queue is committed to the repo on
purpose. Open `ig-auto/queue/` in the GitHub app on your phone. Edit
`rendered_caption` in any `.json`, or delete the file to drop that post. Git
history is a free audit trail.

**Alerts** go to the ntfy topics the blog and reviews jobs already use — high
priority when a post fails or the queue runs dry, normal when a post goes out.

---

## Things that will bite you

- **Creating a media container uploads nothing.** It only hands Meta a URL;
  Meta downloads the picture afterwards, on its own servers. Publishing before
  that finishes fails with `Media ID is not available` (code 9007, subcode
  2207027). It is a race, so it looks fine until it is not — the first two
  posts went out, every one after them failed. `publish.mjs` now polls
  `status_code` until `FINISHED`. Never publish straight after creating a
  container.
- **A failed publish must not build a new container.** A new container means a
  new download and the same race. Retry the same `creation_id`.
- **Meta's short message hides the reason.** `graphCall()` prints the code, the
  subcode and the `fbtrace_id`; without them `API access blocked.` and
  `Media ID is not available` look like the same wall. `API access blocked.`
  was seen on `/media` on 12 Aug 2026 and went away on its own — if it comes
  back, the code and subcode are now in the log.
- **A green workflow does not mean a post.** The publish step failing still
  lets the "commit the record" step run. Read `ledger.jsonl`, not the tick.

---

## Files

| Path | What it does |
| --- | --- |
| `config.json` | cadence, queue depth, image mix, transport |
| `brand.json` | voice, facts, the 12 angles, hashtag pools, ban list |
| `lib/queue.mjs` | queue, ledger, lock, daily guard, dedupe |
| `lib/image.mjs` | picks a real photo, crops to 4:5 (feed) or 9:16 (story) |
| `lib/caption.mjs` | reads the photo, writes the words, blocks repeats |
| `lib/publish.mjs` | transports: `graph`, `make-webhook`, `dry-run` |
| `lib/notify.mjs` | ntfy push |
| `make-scenario.blueprint.json` | only for the Make fallback (feed only) |
| `bin/topup.mjs` | fill both queues |
| `bin/post.mjs` | publish the oldest item (`IG_KIND=story` for a story) |
| `bin/status.mjs` | health at a glance |
| `bin/heartbeat.mjs` | "has it quietly stopped?" — runs twice a week |
| `bin/whoami.mjs` | setup helper — finds `IG_USER_ID` |
| `bin/token-check.mjs` | checks the token is valid and never-expiring |

Test anything without touching Instagram:

```bash
IG_MAX_PER_RUN=1 node bin/topup.mjs
IG_TRANSPORT=dry-run IG_NO_JITTER=1 node bin/post.mjs
IG_TRANSPORT=dry-run IG_NO_JITTER=1 IG_KIND=story node bin/post.mjs
```

---

## Not done yet

- **Reels.** The queue format would carry a video fine, but nothing generates
  video yet. Images daily, video later.
- **Location tag.** The API accepts a `location_id` on feed posts. Tagging
  Funchal helps local discovery. Needs the Page ID for the location.
- **Alt text.** Supported by the API, not wired up yet.
