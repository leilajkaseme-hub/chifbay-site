#!/bin/bash
# run-local-google-sync.sh — scrapes Google reviews and pushes just that
# data file. Runs on this Mac (launchd, com.chifbay.google-reviews) instead
# of GitHub Actions because Google serves cloud/datacenter IPs a "limited
# view" of Maps with the Reviews tab stripped out — confirmed by testing
# the identical script from both a residential-ish IP (works) and GitHub's
# runners (blocked). A home IP doesn't hit that wall.
#
# Deliberately narrow scope: this only refreshes
# scripts/reviews-auto/data/google-reviews.json + assets/reviews/google/.
# Regenerating reviews.html/reviews.json from all sources (GYG + Google +
# Tripadvisor) stays the cloud workflow's job (reviews-auto.yml, every 6h)
# so there's one place that owns the merge/publish step, not two.
set -euo pipefail

REPO_DIR="/Users/futurx/Claude/stores/chifbay/site"
SCRIPT_DIR="$REPO_DIR/scripts/reviews-auto"
NTFY_ALERTS="https://ntfy.sh/futurx-blog-alerts-544024878e"

fail() {
  curl -s --max-time 20 \
    -H "Title: CHIFBAY Google reviews sync FAILED (local)" \
    -H "Priority: high" -H "Tags: rotating_light,boat" \
    -d "$1" "$NTFY_ALERTS" >/dev/null 2>&1 || true
  exit 1
}

cd "$REPO_DIR" || fail "repo dir missing: $REPO_DIR"
git pull --rebase origin main --quiet || fail "git pull failed"

cd "$SCRIPT_DIR" || fail "reviews-auto dir missing"
[ -d node_modules ] || npm install --no-audit --no-fund || fail "npm install failed"

node scrape-google.mjs || fail "scrape-google.mjs failed — see log"

cd "$REPO_DIR"
CHANGES="$(git status --porcelain -- scripts/reviews-auto/data/google-reviews.json assets/reviews/google/)"
if [ -z "$CHANGES" ]; then
  exit 0
fi

git add scripts/reviews-auto/data/google-reviews.json assets/reviews/google/ || fail "git add failed"
git commit -m "Local Google reviews sync" --quiet || fail "git commit failed"
git pull --rebase origin main --quiet || fail "git pull (pre-push) failed"
git push origin main --quiet || fail "git push failed"
