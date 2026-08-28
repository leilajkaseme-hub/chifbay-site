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

## Setting it up — three steps, about ten minutes

Steps 1 and 2 are in Google's consoles and only the account owner can do them.

### 1. Create a service account

A service account is a robot Google account. Its credential never expires and
nobody has to re-approve a consent screen, which is the reason it was chosen
over a normal OAuth login.

1. https://console.cloud.google.com/ — pick a project or make one
2. Enable the **Google Drive API** for it
3. **IAM & Admin → Service Accounts → Create**. Any name. No roles needed —
   it gets its access from the folder being shared with it, not from IAM.
4. Open it → **Keys → Add key → Create new key → JSON**. A file downloads.
5. Copy the `client_email` from that file. It looks like
   `something@your-project.iam.gserviceaccount.com`.

### 2. Share the folder with it

1. Open the **publish** folder in Drive, in `chifandcopt@gmail.com`
2. Share → paste the `client_email` → **Viewer** → Send
3. Copy the folder id out of the URL. In
   `https://drive.google.com/drive/folders/1A2B3C4D5E6F`
   the id is `1A2B3C4D5E6F`.

Viewer, not Editor, on purpose: this job never writes to Drive and never
deletes. The folder is yours; a sync job that *can* delete photos is a sync job
that eventually does.

### 3. Two GitHub secrets

In the `chifbay-site` repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole contents of the JSON key file |
| `DRIVE_PUBLISH_FOLDER_ID` | the folder id from step 2 |

Then run the workflow once by hand from the Actions tab to prove it.

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
