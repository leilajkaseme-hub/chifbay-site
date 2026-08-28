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

### 3. The key and the two secrets — LEFT TO DO

Do the whole of this in one sitting, so the private key is never left sitting in
your Downloads folder.

1. Open the service account:
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=decoded-shadow-503522-g1
2. Click `chifbay-drive-publish...` → **Keys → Add key → Create new key → JSON**.
   A file downloads. **That file is a private key** — it is the whole credential,
   so treat it like a password.
3. In the `chifbay-site` repo → Settings → Secrets and variables → Actions →
   New repository secret:

| Secret | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the entire contents of the downloaded JSON file |
| `DRIVE_PUBLISH_FOLDER_ID` | `1s2Jh9uGJn9SPyB7vpEyEW7uGus3mrF1s` |

4. Delete the downloaded JSON file from your machine. GitHub has it now, and a
   private key in a Downloads folder is the thing that leaks later.
5. Actions tab → **ig-auto — pull new photos from the Drive publish folder** →
   Run workflow. Drop a photo in PUBLISH first so there is something to pull.

Until those secrets exist the daily job exits cleanly with a notice instead of
failing, so nothing is broken in the meantime.

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

## A pre-existing fault this uncovered

`bin/check-library.mjs` already reports it, and it is worth fixing separately:

```
"../klook-photos" is outside the repo
"../clickandboat-sunset-photos" is outside the repo
```

Both are in `config.library_dirs`, and **GitHub Actions only ever sees what is
committed**, so no photo in either folder has ever been postable from CI. They
work locally and silently contribute nothing in the cloud. Fix is to move the
photos into `social/` and drop the two entries.

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
