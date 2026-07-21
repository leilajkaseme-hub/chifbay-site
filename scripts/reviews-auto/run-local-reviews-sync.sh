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

REPO_DIR="/Users/futurx/Claude/stores/chifbay/site"
SCRIPT_DIR="$REPO_DIR/scripts/reviews-auto"
NTFY_ALERTS="https://ntfy.sh/futurx-blog-alerts-544024878e"
NTFY_INBOX="https://ntfy.sh/futurx-inbox-544024878e"

fail() {
  curl -s --max-time 20 \
    -H "Title: CHIFBAY reviews sync FAILED (local)" \
    -H "Priority: high" -H "Tags: rotating_light,boat" \
    -d "$1" "$NTFY_ALERTS" >/dev/null 2>&1 || true
  exit 1
}

cd "$REPO_DIR" || fail "repo dir missing: $REPO_DIR"
git pull --rebase origin main --quiet || fail "git pull failed"

cd "$SCRIPT_DIR" || fail "reviews-auto dir missing"
[ -d node_modules ] || npm install --no-audit --no-fund || fail "npm install failed"

node scrape-gyg.mjs || fail "scrape-gyg.mjs failed — see launchd-err.log"
node scrape-google.mjs || fail "scrape-google.mjs failed — see launchd-err.log"

BUILD_LOG="$(mktemp)"
node build-reviews.mjs | tee "$BUILD_LOG" || fail "build-reviews.mjs failed — see launchd-err.log"
NEW_COUNT="$(grep -o 'NEW_REVIEW_COUNT=.*' "$BUILD_LOG" | cut -d= -f2 || true)"
NEW_SUMMARY="$(grep -o 'NEW_REVIEW_SUMMARY=.*' "$BUILD_LOG" | cut -d= -f2- || true)"
rm -f "$BUILD_LOG"

cd "$REPO_DIR"
CHANGES="$(git status --porcelain)"
if [ -z "$CHANGES" ]; then
  exit 0
fi

git add -A || fail "git add failed"
git commit -m "Reviews sync (local): ${NEW_COUNT:-0} new review(s)" --quiet || fail "git commit failed"
git pull --rebase origin main --quiet || fail "git pull (pre-push) failed"
git push origin main --quiet || fail "git push failed"

if [ -n "${NEW_COUNT:-}" ] && [ "$NEW_COUNT" != "0" ]; then
  curl -s --max-time 20 \
    -H "Title: New Chifbay review(s)" \
    -H "Priority: default" -H "Tags: star,boat" \
    -d "${NEW_COUNT} new review(s): ${NEW_SUMMARY:-}" \
    "$NTFY_INBOX" >/dev/null 2>&1 || true
fi
