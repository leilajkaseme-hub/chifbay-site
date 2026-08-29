# The Drive "publish" folder

Drop a photo in a Google Drive folder. It posts to Instagram the next morning.

## How it is wired

```
you drop a photo in Drive
        |
04:30 UTC   drive-sync    Drive  ->  social-drive/   ->  git push
05:00 UTC   top-up        social-drive/ is a library dir, the photo enters the queue
10:00 UTC   post          the queue's oldest carousel goes to Instagram
17:00 UTC   story
```

Nothing new posts. `drive-sync` only puts files in the photo library that
ig-auto already reads. Every guard that protects the daily post — the
post-once-a-day lock, the 15:00 and 20:30 catch-up runs, the 21:00 heartbeat —
protects a Drive photo too, because by then it is an ordinary library photo.

That is why it was built this way. A second publisher watching Drive would race
the one that already works: two posts on some days, none on others, and two
places to look when Instagram changes something.

**A photo posts the day after it lands**, not the same day, because the queue is
built once at 05:00. That is the "next day at a fixed hour" the brief asked for.

## Setting it up

Most of it is already done. **Steps 1 and 2 below are finished** — recorded here
so the setup can be rebuilt or audited later. Only step 3 is left, and it is two
copy-pastes.

### 1. Service account — DONE 2026-08-28

| | |
|---|---|
| Google Cloud project | **My Project 65947** — `decoded-shadow-503522-g1` |
| Google Drive API | **enabled** |
| Service account | `chifbay-drive-publish@decoded-shadow-503522-g1.iam.gserviceaccount.com` |
| IAM roles | **none, deliberately** — its access comes from the folder share, not from IAM |

A service account is a robot Google account. Its credential never expires and
nobody has to re-approve a consent screen, which is why it beat a normal OAuth
login for a job that must run unattended for years.

### 2. Folder shared — DONE 2026-08-28

| | |
|---|---|
| Folder | **PUBLISH**, in `chifandcopt@gmail.com` (owner: Chif & Co) |
| Folder id | `1s2Jh9uGJn9SPyB7vpEyEW7uGus3mrF1s` |
| Service account access | **Viewer** |
| General access | **Restricted** — not public, and it must stay that way |

Viewer, not Editor, on purpose: this job never writes to Drive and never
deletes. The folder is yours; a sync job that *can* delete photos is a sync job
that eventually does.

### 3. Secrets

`DRIVE_PUBLISH_FOLDER_ID` — **DONE 2026-08-28.** It is a folder id, not a
credential; it is in this file and in the git history already.

`GOOGLE_SERVICE_ACCOUNT_JSON` — **left to the account owner, deliberately.**
That file is a private key: whoever holds it can read this Drive. Creating it
and moving it is a two-minute job and it belongs to the person who owns the
account, not to an assistant session.

Three commands, in one sitting, so the key is never left lying around:

```bash
# 1. Create the key in the console:
#    https://console.cloud.google.com/iam-admin/serviceaccounts?project=decoded-shadow-503522-g1
#    click chifbay-drive-publish -> Keys -> Add key -> Create new key -> JSON

# 2. Push the file straight into the secret. Nothing is opened, printed or
#    pasted — gh encrypts it locally and uploads it. Fix the filename first.
gh secret set GOOGLE_SERVICE_ACCOUNT_JSON \
  --repo leilajkaseme-hub/chifbay-site \
  < ~/Downloads/decoded-shadow-503522-g1-XXXXXXXX.json

# 3. Shred the local copy. GitHub has it now, and a private key parked in
#    Downloads is the one that leaks six months from now.
rm ~/Downloads/decoded-shadow-503522-g1-XXXXXXXX.json
```

Prefer that to pasting the JSON into the GitHub web form: the value never
touches a clipboard, a terminal scrollback or a browser field.

Then check and run it:

```bash
gh secret list --repo leilajkaseme-hub/chifbay-site      # both names present?
gh workflow run ig-auto-drive-sync.yml --repo leilajkaseme-hub/chifbay-site
```

Drop a photo in PUBLISH first, or the run has nothing to pull.

Until that secret exists the daily job exits cleanly with a notice instead of
failing, so nothing is broken in the meantime.

**If the key ever leaks**, delete it on that same Keys page and create a new
one. The service account keeps its Drive access; only the key changes.

## Checking it

```bash
node bin/drive-sync.mjs --check    # lists what is new, downloads nothing
node bin/drive-sync.mjs            # pulls
node bin/check-library.mjs         # confirms the library is usable
```

`--check` needs the same two env vars, so it is also the fastest way to prove
the credential works.

## Things worth knowing

**Still images only.** JPEG, PNG, WebP, HEIC. Anything else — a video, a PDF, a
Google Doc — is listed as skipped in the log rather than ignored quietly.
ig-auto has no video path yet.

**A folder it cannot see is a hard error, not a quiet zero.** `files.list` on
an unshared folder returns an empty list — identical to an empty folder — so a
share that never took would have logged `0 file(s)` every morning and looked
healthy. `drive-sync` calls `files.get` on the folder id first, which really
does 404, and stops with the reason. It also refuses an id that turns out to be
a file rather than a folder.

**The state file is keyed on the Drive file id**, not the filename, in
`drive-state.json`. Rename a photo in Drive and it is not pulled twice. Two
photos with the same name do not collide.

**Deleting from Drive does not delete anything here.** Once a photo is pulled it
is a repo file and it stays in the library. Remove it from `social-drive/` if
you want it gone.

**`social-drive` registers itself in `config.library_dirs` on the first
successful pull**, not before. `bin/check-library.mjs` treats an empty library
directory as a broken library and stops the whole run, so adding the entry up
front would have stopped ig-auto posting between shipping this and the first
photo arriving.

**This job is allowed to fail.** It fills a buffer that holds about twelve days.
A broken sync is this week's problem, not tonight's.

## A pre-existing fault this uncovered — FIXED 2026-08-29

`config.library_dirs` used to hold two folders that sit NEXT TO the repo, not
inside it:

```
"../klook-photos"                 5 photos
"../clickandboat-sunset-photos"   the same 5 photos, renamed
```

**GitHub Actions only ever sees what is committed**, so those five real photos
of the boat could never be posted from the cloud. The laptop counted 87 files /
82 distinct photos; CI counted 77. Nothing failed and no log said anything —
the only symptom was a number nobody was comparing across two machines.

Fixed: the five are committed into `social/` as `onboard-*.jpg`, both entries
are gone from `config.json`, and `bin/check-library.mjs` now fails the run if a
library folder is ever outside the repo again. Library is 82 photos, same on
both machines.

## Google Business Profile

Not built, and it cannot be built yet. The Business Profile API is gated: you
have to apply and be approved before any code can post to it. The requirements
are a verified profile at least 60 days old, a real business website, and a
stated use case.

**Apply first, build after** — the approval is the long pole, and everything
else here is ready to feed it. The application is at
https://developers.google.com/my-business — request access for the same Google
Cloud project created in step 1, so the service account and the Business
Profile access live together.

Worth doing early for a second reason: of the named businesses ChatGPT shows in
its answers, **88.8% come from Google Places** — measured across 99,538 entities
in 2026. For a local operator, the Google profile is a bigger AI-visibility
lever than anything on the website.
