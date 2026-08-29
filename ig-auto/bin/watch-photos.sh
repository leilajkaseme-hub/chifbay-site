#!/bin/bash
# watch-photos.sh — replan the grid whenever photos are added to social/.
#
# launchd runs this on any change inside site/social (see the plist next to it).
# It rebuilds the plan and the preview, then puts a Mac notification on screen.
# Click it and the new grid opens.
#
# It deliberately does NOT commit or push. Photos are content: the preview is
# there to be looked at first. Set AUTOPUSH=1 in the plist if you would rather
# it went all the way on its own — the GitHub side replans again after any push
# and sends the grid to your phone, so nothing is lost either way.
set -euo pipefail

# launchd hands a job a bare PATH — /usr/bin:/bin:/usr/sbin:/sbin — so node,
# installed by homebrew, is simply not there and the job dies with a message
# nobody reads. Every launchd job in this folder has been bitten by this.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="$(dirname "$HERE")"
LOG="$HERE/.watch-photos.log"

exec >>"$LOG" 2>&1
echo "--- $(date '+%Y-%m-%d %H:%M:%S') photo folder changed"

# Copying a batch of photos in Finder fires the watch on the first file. Give
# the rest a moment to land, or the plan gets built from half a batch and has
# to be built again.
sleep 20

cd "$HERE"

if ! node bin/check-library.mjs; then
  osascript -e 'display notification "The photo library is broken — see ig-auto/.watch-photos.log" with title "Chifbay grid" sound name "Basso"' || true
  exit 1
fi

before=$(node -e 'const p=require("./feed-plan.json");console.log(p.posts.length)' 2>/dev/null || echo 0)
node bin/feed-plan.mjs --write --preview --report
after=$(node -e 'const p=require("./feed-plan.json");console.log(p.posts.length)')

# The one number worth surfacing: the biggest temperature step between two
# squares that touch. Under 25 and nobody reads the grid as changing colour.
worst=$(node bin/feed-plan.mjs --report 2>/dev/null | grep -A1 'WARM-COLD step' | tail -1 | grep -oE 'worst [0-9.]+' || echo "worst ?")

osascript -e "display notification \"${after} posts planned (was ${before}). ${worst}. Open feed-preview.jpg.\" with title \"Chifbay grid replanned\"" || true

if [ "${AUTOPUSH:-0}" = "1" ]; then
  cd "$SITE"
  git add social ig-auto
  if ! git diff --staged --quiet; then
    git commit -m "Instagram: new photos, grid replanned"
    git pull --rebase origin main || true
    git push
    echo "pushed"
  fi
fi

echo "done: ${after} posts planned"
