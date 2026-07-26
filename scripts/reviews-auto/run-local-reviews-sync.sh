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
# Tripadvisor is still not included anywhere — DataDome (their bot
# mitigation vendor) 403s every scraper attempt, including from this same
# home IP, so that one's genuinely not free-scrapable. data/tripadvisor-
# manual.json stays hand-maintained; build-reviews.mjs folds it in either way.
set -euo pipefail

# Paths are derived from this script's own location, never hardcoded. A
# hardcoded /Users/futurx/... path is exactly what silently broke this job
# when the repo moved to /Users/Shared/Claude — launchd kept firing, every
# run died on `cd`, and no reviews were imported for weeks.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NTFY_ALERTS="https://ntfy.sh/futurx-blog-alerts-544024878e"
NTFY_INBOX="https://ntfy.sh/futurx-inbox-544024878e"

fail() {
  curl -s --max-time 20 \
    -H "Title: CHIFBAY reviews sync FAILED (local)" \
    -H "Priority: high" -H "Tags: rotating_light,boat" \
    -d "$1" "$NTFY_ALERTS" >/dev/null 2>&1 || true
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

cd "$REPO_DIR" || fail "repo dir missing: $REPO_DIR"
git pull --rebase --autostash origin main --quiet || fail "git pull failed"

cd "$SCRIPT_DIR" || fail "reviews-auto dir missing"
[ -d node_modules ] || npm install --no-audit --no-fund || fail "npm install failed"

node scrape-gyg.mjs || fail "scrape-gyg.mjs failed — see launchd-err.log"
node scrape-google.mjs || fail "scrape-google.mjs failed — see launchd-err.log"

# Tripadvisor is deliberately NON-fatal. With no API key it exits 0 and does
# nothing. With a key it can still fail for a reason that has nothing to do
# with the other two sources (e.g. the key's IP allowlist went stale after an
# ISP address change). That must never block the GetYourGuide/Google import,
# so we warn and carry on rather than aborting the run.
if ! node scrape-tripadvisor.mjs; then
  curl -s --max-time 20 \
    -H "Title: Chifbay Tripadvisor import failed (other sources OK)" \
    -H "Priority: low" -H "Tags: warning,boat" \
    -d "scrape-tripadvisor.mjs failed; GetYourGuide + Google still synced. Check the key's IP allowlist at tripadvisor.com/developers." \
    "$NTFY_ALERTS" >/dev/null 2>&1 || true
fi

BUILD_LOG="$(mktemp)"
node build-reviews.mjs | tee "$BUILD_LOG" || fail "build-reviews.mjs failed — see launchd-err.log"
NEW_COUNT="$(grep -o 'NEW_REVIEW_COUNT=.*' "$BUILD_LOG" | cut -d= -f2 || true)"
NEW_SUMMARY="$(grep -o 'NEW_REVIEW_SUMMARY=.*' "$BUILD_LOG" | cut -d= -f2- || true)"
rm -f "$BUILD_LOG"

cd "$REPO_DIR"

# Everything scraped and built cleanly — that is a successful run whether or
# not it produced a diff, so stamp the heartbeat before the early exit.
date +%s > "$HEARTBEAT"

CHANGES="$(git status --porcelain)"
if [ -z "$CHANGES" ]; then
  exit 0
fi

git add -A || fail "git add failed"
git commit -m "Reviews sync (local): ${NEW_COUNT:-0} new review(s)" --quiet || fail "git commit failed"
git pull --rebase --autostash origin main --quiet || fail "git pull (pre-push) failed"
git push origin main --quiet || fail "git push failed"

if [ -n "${NEW_COUNT:-}" ] && [ "$NEW_COUNT" != "0" ]; then
  curl -s --max-time 20 \
    -H "Title: New Chifbay review(s)" \
    -H "Priority: default" -H "Tags: star,boat" \
    -d "${NEW_COUNT} new review(s): ${NEW_SUMMARY:-}" \
    "$NTFY_INBOX" >/dev/null 2>&1 || true
fi
