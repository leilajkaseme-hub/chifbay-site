#!/usr/bin/env bash
# ci-push.sh — put a bot commit on main without losing a race to another job.
#
# Every publishing workflow used to end with:
#
#     git pull --rebase origin main || true
#     git push
#
# The `|| true` is the bug. When two jobs push in the same minute the rebase
# stops on a conflict, `|| true` swallows it, the repo is left MID-REBASE on a
# detached HEAD, and the `git push` that follows fails with "You are not
# currently on a branch" — which says nothing about what actually happened.
# The job goes red and fires an alert even when the work itself was fine. That
# happened on 2026-08-29: the grid replanned correctly, the plan reached main,
# and the run still reported failure and pushed a false alarm to the phone.
#
# False alarms are the real damage here. This feed has already died once behind
# an alert nobody trusted any more.
#
# So: fetch, rebase, push, and retry — a lost race is normal and costs a few
# seconds, not a red run. A genuine conflict stops with the file names in the
# message instead of a git hint about branches.
#
# Usage:  scripts/ci-push.sh [--regenerate "<command>"]
#
# --regenerate is for DETERMINISTIC generated files only, where rebuilding on
# top of the newer main is the correct answer (the feed plan). Never pass it
# for anything that records that something was published — a ledger entry
# rebuilt from scratch is a post that silently claims not to have happened.
set -uo pipefail

REGEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --regenerate) REGEN="${2:-}"; shift 2 ;;
    *) echo "ci-push.sh: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

ATTEMPTS="${CI_PUSH_ATTEMPTS:-5}"
# Overridable so the recovery paths below can be exercised against a throwaway
# branch instead of main. A recovery path that has never run is not one.
BRANCH="${CI_PUSH_BRANCH:-main}"
MSG="$(git log -1 --pretty=%s)"

for i in $(seq 1 "$ATTEMPTS"); do
  git fetch -q origin "$BRANCH"

  if REBASE_OUT="$(git rebase "origin/$BRANCH" 2>&1)"; then
    if git push -q origin "HEAD:$BRANCH" 2>/dev/null; then
      echo "pushed on attempt ${i}: ${MSG}"
      exit 0
    fi
    echo "attempt ${i}: someone pushed first, trying again"
  else
    CONFLICTS="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
    git rebase --abort >/dev/null 2>&1 || true

    # A rebase that never STARTED is not a conflict, and calling it one sends
    # whoever reads the log hunting for a merge that never happened. The usual
    # cause is an earlier step leaving the tree dirty. Found by testing this
    # exact path: it announced "conflict on unknown files" for a stray edit.
    if [ -z "$CONFLICTS" ]; then
      echo "::error::ci-push: could not rebase onto origin/$BRANCH, and nothing conflicted."
      echo "That usually means the working tree was dirty before the push. git said:"
      echo "$REBASE_OUT" | sed 's/^/  /'
      exit 1
    fi

    if [ -z "$REGEN" ]; then
      echo "::error::ci-push: conflict on ${CONFLICTS:-unknown files} against origin/$BRANCH."
      echo "Another job changed the same generated file. Nothing was pushed and the"
      echo "working tree is clean — re-run this workflow, it is safe to repeat."
      exit 1
    fi

    echo "attempt ${i}: conflict on ${CONFLICTS:-?} — rebuilding on top of the newer origin/$BRANCH"
    git reset -q --hard "origin/$BRANCH"
    if ! bash -c "$REGEN"; then
      echo "::error::ci-push: the regenerate command failed: $REGEN"
      exit 1
    fi
    git add -A
    if git diff --staged --quiet; then
      echo "after rebuilding there is nothing left to push — the other job's result is equivalent"
      exit 0
    fi
    git commit -q -m "$MSG"
  fi

  sleep $(( i * 4 ))
done

echo "::error::ci-push: still could not push after ${ATTEMPTS} attempts."
exit 1
