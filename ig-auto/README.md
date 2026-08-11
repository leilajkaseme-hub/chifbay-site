# ig-auto — one Instagram post a day for @chifbay

Runs in GitHub's cloud on a schedule. **Your computer can be off.**

**Free to run. No Meta developer app, no API keys of your own.**

---

## How it works

```
05:00 UTC   top up      build posts days ahead  ->  queue/ + ig/  ->  git push
10:00 UTC   post        oldest item in queue    ->  Make          ->  Instagram
            (+ 0-90 min random wait)
Mon + Thu   heartbeat   "did a post go out?"    ->  alert if it quietly stopped
```

Two jobs, on purpose:

- **Top-up** is allowed to fail. It fills the queue to 12 posts. If it breaks
  for a week, nothing bad happens.
- **Post** must not fail. It takes the oldest item and publishes it. It uses
  **no npm packages at all** — only Node's standard library — so there is
  almost nothing in it that can break.

That is the whole reliability idea: the part that must work is tiny, and it has
a 12-day buffer in front of it.

---

## Why there is no Meta developer app

Make holds the Instagram connection. Make owns the Meta app, so on your side
there is nothing to register, no app review, no `instagram_content_publish`
permission to request, and **no access token that expires every 60 days**.

GitHub Actions sends `{image_url, caption}` to a Make webhook. Make posts it and
answers with the new post's id, which goes into the ledger.

Cost: **free**. One post a day is about **93 of Make's 1,000 monthly
operations** (3 modules × 31 days). Free also allows 2 active scenarios; this
needs 1.

### The one thing that can bite — read this

Those 1,000 operations are **shared across every scenario in the Make account**,
and when they run out the whole organisation stops.

Right now the **"SafePay Studio Waitlist"** scenario has used **986 operations on
its own** — that is why the Make org currently shows as paused. If it keeps
running, it will eat each month's allowance and Instagram posting will stop.

**Turn that scenario off** (or delete it) unless SafePay Studio is live. The
allowance resets at the start of each month.

Two things defend against this anyway:

- The Make scenario answers with the real post id. If the organisation is out of
  operations the webhook still replies a cheerful `Accepted` and posts nothing —
  so `lib/publish.mjs` **treats a missing id as a failure**, which retries and
  alerts instead of silently doing nothing.
- `bin/heartbeat.mjs` runs twice a week and shouts if no post has gone out for
  more than 2 days, whatever the cause.

> One thing no method avoids: Instagram requires the account to be a **Business
> or Creator account linked to a Facebook Page**. That is an Instagram rule, not
> an API-key rule. @chifbay is already a Business account.

If you ever change your mind about a Meta app, `lib/publish.mjs` has a `graph`
transport ready — direct to Meta, no middleman, no operation budget at all. Use
a System User token with expiry "Never" and `bin/token-check.mjs` watches it.

---

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

Every image leaves as a **1080x1350 JPEG** — Instagram's 4:5 portrait, the ratio
that takes the most space in the feed, and safely inside Meta's accepted range
so a tall or panoramic original can never be rejected.

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

- **Random posting time.** Fires at 10:00 UTC, then waits 0-90 minutes. Posting
  at exactly the same second every day is the most obviously automated thing an
  account can do.
- **Hashtags rotate.** 5-8 per post, chosen least-recently-used across four
  pools plus tags specific to what is in the photo. The set is never identical
  to any of the last 10 posts. Big blocks of the same 30 tags are the classic
  reach killer. `brand.json` also has a ban list of engagement-bait tags.
- **Captions cannot repeat.** Every new caption is compared against the last 30.
  Too similar, and it gets rewritten.
- **Subjects cycle.** All 12 angles run before any of them comes back.
- **No photo twice, ever.** Every posted image's sha256 is checked before
  publishing. Source files also get a 120-day cooldown.
- **One post a day, never a burst.** Enforced by the daily guard, not by luck.

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

One-time, about 10 minutes. Nothing here costs money.

### 1. Free the Make allowance first

[make.com](https://make.com) → Scenarios → **SafePay Studio Waitlist** → switch
it **off**, or delete it if SafePay Studio is not live. It has already used 986
of the 1,000 monthly operations on its own.

Then check the organisation is not paused. If it is, it should clear at the
start of the month once nothing is burning operations.

### 2. Import the scenario

Make → Scenarios → **Create new** → the `...` menu → **Import Blueprint** →
upload `make-scenario.blueprint.json`.

1. Click the **Instagram** module → **Add connection** → log in with the
   Facebook account that manages the Chifbay Page
2. Under **Page**, pick @chifbay
3. Click the **webhook** module → **Copy address to clipboard**
4. **Turn the scenario ON**

Leave the scheduling as **immediately** — it is triggered by the webhook, not by
a clock.

> Do not remove the last module. That "Webhook response" step is what returns
> the real post id, and the poster treats a missing id as a failure. Without it
> a dead scenario would look like a successful post.

### 3. GitHub secrets
Repo → Settings → Secrets and variables → Actions:

| Secret | What it is |
| --- | --- |
| `MAKE_IG_WEBHOOK` | the webhook URL from step 2.3 |
| `CLAUDE_CODE_OAUTH_TOKEN` | already set — used by the blog job |
| `OPENAI_API_KEY` | optional, only for better AI scenery |

### 4. Prove it works, in this order

1. Actions → **Chifbay Instagram — top up the queue** → Run workflow.
   Wait for the push, then read `ig-auto/queue/` and check you like the posts.
2. Actions → **Chifbay Instagram — daily post** → Run workflow.
   One real post goes out, and the log should print a `MEDIA_ID`. If it prints
   an error about `Accepted`, the Make scenario is off or out of operations.
3. Actions → **Chifbay Instagram — heartbeat** → Run workflow. Should say
   `all good`.

After that the schedule takes over on its own.

---

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

## Files

| Path | What it does |
| --- | --- |
| `config.json` | cadence, queue depth, image mix, transport |
| `brand.json` | voice, facts, the 12 angles, hashtag pools, ban list |
| `lib/queue.mjs` | queue, ledger, lock, daily guard, dedupe |
| `lib/image.mjs` | picks a real photo or generates scenery, crops to 4:5 |
| `lib/caption.mjs` | reads the photo, writes the words, blocks repeats |
| `lib/publish.mjs` | transports: `make-webhook`, `graph`, `dry-run` |
| `lib/notify.mjs` | ntfy push |
| `make-scenario.blueprint.json` | the Make scenario, ready to import |
| `bin/topup.mjs` | fill the queue |
| `bin/post.mjs` | publish the oldest item |
| `bin/status.mjs` | health at a glance |
| `bin/heartbeat.mjs` | "has it quietly stopped?" — runs twice a week |
| `bin/whoami.mjs` | only for the `graph` transport — finds `IG_USER_ID` |
| `bin/token-check.mjs` | only for the `graph` transport — watches the token |

Test anything without touching Instagram:

```bash
IG_MAX_PER_RUN=1 node bin/topup.mjs
IG_TRANSPORT=dry-run IG_NO_JITTER=1 node bin/post.mjs
```

---

## Not done yet

- **Reels.** Make has `CreateAReelPost` and the queue format would carry a video
  fine, but nothing generates video yet. Images daily, video later.
- **Location tag.** `CreatePostPhoto` accepts a `location_id`. Tagging Funchal
  on every post helps local discovery. Needs the Page ID for the location.
- **Alt text.** Not exposed by the Make module.
