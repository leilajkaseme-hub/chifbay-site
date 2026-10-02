#!/bin/bash
# run-local-reviews-sync.sh — the full reviews pipeline (scrape GetYourGuide
# + Google, merge, translate, regenerate reviews.html/reviews.json, commit,
# push), run entirely on this Mac via launchd (com.chifbay.reviews-sync).
#
# Why local and not GitHub Actions: BOTH GetYourGuide and Google actively
# block GitHub's shared runner IPs — confirmed via debug logging on real
# CI runs. GetYourGuide returns a Cloudflare "An error occurred" page
# (Ray ID and all) to every one of the 4 tour pages; Google serves a
# "limited view" of Maps with the Reviews tab stripped out. Both work fine
# from this Mac's home IP. The GitHub Action (reviews-auto.yml) is kept
# around as a manual-trigger-only fallback, not on a schedule, since it
# cannot succeed unattended from GitHub's infrastructure.
#
# Tripadvisor is scraped too (see the Route 2 block below) — real Chrome in
# HEADED mode gets past DataDome, their bot mitigation vendor, from this same
# home IP. It pulls from all 4 of Chifbay's Tripadvisor pages: the claimed
# attraction listing plus one auto-generated review page per Viator-synced
# tour (Chifbay has no single unified Tripadvisor listing). data/tripadvisor-
# manual.json is a hand-maintained fallback; build-reviews.mjs folds it in too.
set -euo pipefail

# Paths are derived from this script's own location, never hardcoded. A
# hardcoded /Users/futurx/... path is exactly what silently broke this job
# when the repo moved to /Users/Shared/Claude — launchd kept firing, every
# run died on `cd`, and no reviews were imported for weeks.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NTFY_ALERTS="https://ntfy.sh/futurx-blog-alerts-544024878e"
NTFY_INBOX="https://ntfy.sh/futurx-inbox-544024878e"

# Every run reports to the booking server (/v1/ingest/reviews), success or
# not. The external watchdog (apps/stores-watch) reads that report and sends
# a Telegram alert when the job stops running OR keeps failing. Until
# 2 Oct 2026 failures only went to an ntfy topic nobody read, and the push
# failed on every run for a month while the heartbeat said "success".
API="https://chifbay-booking-api.chifandcopt.workers.dev"
OTA_TOKEN_FILE="$(cd "$SCRIPT_DIR/../../../../.." && pwd)/.credentials/chifbay-ota.token"
STAGE="start"
report() {   # report <ok:true|false> <published:true|false> [error]
  [ -f "$OTA_TOKEN_FILE" ] || return 0
  local summary
  summary="$(node "$SCRIPT_DIR/run-summary.mjs" "${PUBLISH_DIR:-$REPO_DIR}" 2>/dev/null || echo '{}')"
  curl -s --max-time 20 -X POST "$API/v1/ingest/reviews" -H "Content-Type: application/json" \
    -d "{\"token\":\"$(tr -d '\n' < "$OTA_TOKEN_FILE")\",\"ok\":$1,\"published\":$2,\"stage\":\"$STAGE\",\"error\":$(printf '%s' "${3:-}" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8").slice(0,300)))'),\"summary\":$summary}" >/dev/null 2>&1 || true
}
# After a publish, bring this checkout up to date without ever discarding
# work: only files the scrapers write are touched, and only when origin/main
# holds the exact same bytes. Anything else in the checkout stays as it is.
sync_local() {
  ( cd "$REPO_DIR" || exit 0
    git fetch --quiet origin main || exit 0
    [ "$(git branch --show-current)" = "main" ] || exit 0
    git status --porcelain -- scripts/reviews-auto/data assets/reviews | sed 's/^...//' | while read -r f; do
      [ -f "$f" ] || continue
      if git show "origin/main:$f" 2>/dev/null | cmp -s - "$f"; then
        if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then git checkout --quiet -- "$f"; else rm -f "$f"; fi
      fi
    done
    git merge --ff-only --quiet origin/main >/dev/null 2>&1 || true
  ) || true
}
fail() {
  curl -s --max-time 20 \
    -H "Title: CHIFBAY reviews sync FAILED (local)" \
    -H "Priority: high" -H "Tags: rotating_light,boat" \
    -d "$1" "$NTFY_ALERTS" >/dev/null 2>&1 || true
  report false false "$1"
  exit 1
}

HEARTBEAT="$SCRIPT_DIR/data/last-success.txt"

# Staleness notice. This job previously died silently and nobody noticed for
# weeks, so on every run we report how long it has been since the last SUCCESS.
# If that gap is over 36h something has been wrong and the run that finally
# succeeds says so, rather than quietly papering over the outage.
if [ -f "$HEARTBEAT" ]; then
  LAST_TS="$(cat "$HEARTBEAT" 2>/dev/null || echo 0)"
  NOW_TS="$(date +%s)"
  GAP=$(( (NOW_TS - LAST_TS) / 3600 ))
  if [ "$GAP" -gt 36 ]; then
    curl -s --max-time 20 \
      -H "Title: Chifbay reviews sync resumed after ${GAP}h gap" \
      -H "Priority: default" -H "Tags: warning,boat" \
      -d "No successful reviews sync for ${GAP} hours before this run. If unexpected, check launchd-err.log." \
      "$NTFY_ALERTS" >/dev/null 2>&1 || true
  fi
fi

# NOTE: this job deliberately does NOT touch the checkout it lives in.
# It used to start with `git pull --rebase --autostash origin main`, which is
# how it died: on 2026-08-19 that rebase hit a conflict, left the repo mid-
# rebase, and every run for the next eleven days failed on the same line. The
# reviews were scraped correctly every time and never reached the site.
# Scraping needs no git at all, and publishing now happens in a throwaway
# worktree further down, so nothing an editor session does here can stop it.
cd "$SCRIPT_DIR" || fail "reviews-auto dir missing"
[ -d node_modules ] || npm install --no-audit --no-fund || fail "npm install failed"

STAGE="fetch"
node scrape-gyg.mjs || fail "scrape-gyg.mjs failed — see launchd-err.log"
node scrape-google.mjs || fail "scrape-google.mjs failed — see launchd-err.log"

# Tripadvisor. Two routes, tried best-first:
#
#   1. scrape-tripadvisor.mjs         — official Content API. Only runs if a key
#                                       exists at data/.tripadvisor-key. Most
#                                       reliable, but needs a free signup.
#   2. scrape-tripadvisor-browser.mjs — real Chrome, HEADED, dedicated profile.
#                                       Needs nothing. This is what actually
#                                       runs today.
#
# Route 2 works because Tripadvisor's DataDome protection fingerprints the
# browser build and the headless flag: bundled Chromium fails headless AND
# headed, real Chrome fails headless, real Chrome HEADED passes. It requires a
# logged-in GUI session, which a launchd Agent has.
#
# The whole block is NON-fatal. Tripadvisor is the most brittle of the three
# sources and must never be able to block the GetYourGuide/Google import.
TA_OK=0
if [ -f "$SCRIPT_DIR/data/.tripadvisor-key" ] || [ -n "${TRIPADVISOR_API_KEY:-}" ]; then
  if node scrape-tripadvisor.mjs; then TA_OK=1; fi
fi
if [ "$TA_OK" -eq 0 ]; then
  if node scrape-tripadvisor-browser.mjs; then TA_OK=1; fi
fi
if [ "$TA_OK" -eq 0 ]; then
  curl -s --max-time 20 \
    -H "Title: Chifbay Tripadvisor import failed (other sources OK)" \
    -H "Priority: low" -H "Tags: warning,boat" \
    -d "Both Tripadvisor routes failed this run; GetYourGuide + Google still synced. Previously imported Tripadvisor reviews are retained." \
    "$NTFY_ALERTS" >/dev/null 2>&1 || true
fi

# --- publish through a throwaway worktree ----------------------------------
#
# The build is run in a fresh checkout of origin/main, NOT in this repo. That
# matters: build-reviews.mjs rewrites reviews.html and every index.html to
# inject the teaser, so building in a stale checkout and pushing the result
# would quietly revert whatever has been published since. This checkout was
# eleven days behind when the fault was found; publishing from it would have
# undone the legal footer, the booking-page fixes and eleven Journal posts.
#
# Only the freshly scraped JSON crosses over. Templates, copy and every other
# file come from origin/main.
git -C "$REPO_DIR" fetch --quiet origin main || fail "git fetch failed"
WT="$(mktemp -d)/reviews-publish"
git -C "$REPO_DIR" worktree add --quiet --detach "$WT" origin/main || fail "worktree add failed"
cleanup_wt() {
  git -C "$REPO_DIR" worktree remove --force "$WT" >/dev/null 2>&1 || true
  git -C "$REPO_DIR" worktree prune >/dev/null 2>&1 || true
}
trap cleanup_wt EXIT

# Scraper output only. tripadvisor-manual.json is hand-maintained IN the repo,
# so the worktree's own copy (origin/main's) is the authority, not this one.
for f in gyg-tours.json gyg-reviews.json google-reviews.json tripadvisor-reviews.json; do
  if [ -f "$SCRIPT_DIR/data/$f" ]; then
    cp "$SCRIPT_DIR/data/$f" "$WT/scripts/reviews-auto/data/$f"
  fi
done

# The Google and GetYourGuide scrapers download review PHOTOS into
# assets/reviews/ alongside the JSON. They have to cross over too: reviews.json
# carries their paths, so shipping the JSON without the images publishes broken
# pictures. Five of them 404'd on the live site on 2026-08-30 because this copy
# was missing from the first version of this worktree change.
# `/.` merges into the worktree's existing set rather than replacing it.
if [ -d "$REPO_DIR/assets/reviews" ]; then
  mkdir -p "$WT/assets/reviews"
  cp -R "$REPO_DIR/assets/reviews/." "$WT/assets/reviews/" || fail "copying review photos failed"
fi

PUBLISH_DIR="$WT"
STAGE="build"
BUILD_LOG="$(mktemp)"
( cd "$WT/scripts/reviews-auto" && node build-reviews.mjs ) | tee "$BUILD_LOG" \
  || fail "build-reviews.mjs failed — see launchd-err.log"
NEW_COUNT="$(grep -o 'NEW_REVIEW_COUNT=.*' "$BUILD_LOG" | cut -d= -f2 || true)"
NEW_SUMMARY="$(grep -o 'NEW_REVIEW_SUMMARY=.*' "$BUILD_LOG" | cut -d= -f2- || true)"
MISMATCH="$(grep -o 'REVIEW_COUNT_MISMATCH=.*' "$BUILD_LOG" | cut -d= -f2- || true)"
rm -f "$BUILD_LOG"

# A page still claiming a different review count is not cosmetic: every page
# declares the same business @id, so contradictory counts are what gets a rich
# result dropped. It drifted silently twice (2026-07-26, 2026-08-31) because
# nothing checked and nothing said anything. Now it says something.
if [ -n "$MISMATCH" ]; then
  curl -s --max-time 20 \
    -H "Title: Chifbay: a page disagrees on the review count" \
    -H "Priority: default" -H "Tags: warning,boat" \
    -d "$MISMATCH" "$NTFY_ALERTS" >/dev/null 2>&1 || true
fi

cd "$WT"
STAGE="publish"

# Stage ONLY what this pipeline produces. This used to be `git add -A`, which
# meant any unrelated work-in-progress sitting in the repo got swept into the
# sync commit and pushed to production unattended — it happened for real while
# this script was being repaired. Scoping the add keeps an editor session open
# in this repo from being published by a background job.
REVIEW_PATHS=(
  reviews.json
  reviews.html
  index.html
  fr/index.html
  de/index.html
  pt/index.html
  es/index.html
  it/index.html
  assets/reviews
  scripts/reviews-auto/data
)
git add -- "${REVIEW_PATHS[@]}" 2>/dev/null || true
# The build also rewrites the review count on the trip pages (9 pages on
# 2 Oct 2026). Those were left unstaged, and ci-push.sh refuses to rebase a
# tree with unstaged changes: every push failed from early September. This
# worktree is a throwaway checkout of origin/main that only the build has
# touched, so every tracked change in it is the build's own.
git add -u
# Anything still unstaged here would block the push again: say exactly what.
if ! git diff --quiet; then
  fail "build left unstaged changes: $(git diff --name-only | head -5 | tr '\n' ' ')"
fi

if git diff --cached --quiet; then
  date +%s > "$HEARTBEAT"
  report true false
  sync_local
  exit 0
fi
git -c user.name="github-actions[bot]" -c user.email="github-actions[bot]@users.noreply.github.com" \
  commit -m "Reviews sync (local): ${NEW_COUNT:-0} new review(s)" --quiet \
  || fail "git commit failed"

# scripts/ci-push.sh fetches, rebases, pushes and retries — a race with the
# blog or Instagram jobs costs seconds instead of a failed run.
"$WT/scripts/ci-push.sh" || fail "git push failed"
# Success means published, not merely scraped.
date +%s > "$HEARTBEAT"
report true true
sync_local

if [ -n "${NEW_COUNT:-}" ] && [ "$NEW_COUNT" != "0" ]; then
  curl -s --max-time 20 \
    -H "Title: New Chifbay review(s)" \
    -H "Priority: default" -H "Tags: star,boat" \
    -d "${NEW_COUNT} new review(s): ${NEW_SUMMARY:-}" \
    "$NTFY_INBOX" >/dev/null 2>&1 || true
fi
