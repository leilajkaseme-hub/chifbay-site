#!/bin/bash
# Chifbay — local auto-blog. Runs Claude Code headless (your login, no API key)
# to generate + publish one Journal post. Triggered by launchd on a schedule.
export PATH="/Users/futurx/.local/bin:/usr/local/bin:/usr/bin:/bin"
REPO="/Users/futurx/Downloads/Chifbay/dist"
DIR="$REPO/scripts/blog-local"
LOG="$DIR/blog.log"

cd "$REPO" || { echo "$(date): repo not found" >> "$LOG"; exit 1; }
echo "" >> "$LOG"
echo "========== $(date) : starting auto-blog ==========" >> "$LOG"

# stay in sync with the remote before generating
git pull --rebase --quiet >> "$LOG" 2>&1

# Claude Code generates + commits + pushes the post (no API key — uses your login).
# Permissions are SCOPED: only file writes in this repo, web search, and git — no blanket bypass.
claude -p "$(cat "$DIR/BLOG-INSTRUCTIONS.md")" \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Write" "Edit" "Glob" "Grep" "WebSearch" "WebFetch" \
                 "Bash(date:*)" "Bash(git add:*)" "Bash(git commit:*)" "Bash(git push:*)" \
                 "Bash(git pull:*)" "Bash(git status:*)" "Bash(git log:*)" \
  >> "$LOG" 2>&1

echo "========== $(date) : finished ==========" >> "$LOG"
