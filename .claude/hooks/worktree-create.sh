#!/usr/bin/env sh
# Claude Code WorktreeCreate hook: create the worktree with a real
# `git worktree add` so .husky/post-checkout bootstraps it.
#
# Claude's built-in creation populates the tree with `git reset`, which fires no
# post-checkout, so agent-made worktrees arrive without node_modules or a seeded
# D1. Defining this hook replaces that built-in path entirely.
#
# Contract: only the result JSON may reach stdout, and any non-zero exit aborts
# worktree creation.
set -eu

input=$(cat)
source_path=$(printf '%s' "$input" | jq -r '.source_path')
worktree_path=$(printf '%s' "$input" | jq -r '.worktree_path')
is_git=$(printf '%s' "$input" | jq -r '.is_git')

fail() {
  echo "$1" >&2
  exit 1
}

[ "$is_git" = "true" ] || fail "betabook needs a git checkout to make a worktree; source_path is not a repo."

# husky resolves its relative core.hooksPath (.husky/_) against the cwd of the
# invoking git process, so post-checkout only fires when git runs from a
# checkout that has it — the main one.
cd "$source_path" || fail "cannot enter $source_path"
[ -d .husky/_ ] || echo "warning: no .husky/_ in $source_path, worktree will not self-bootstrap" >&2

name=$(basename "$worktree_path")
branch="worktree-${name}"
parent=$(dirname "$worktree_path")
log="${parent}/${name}.create.log"
mkdir -p "$parent"

# The bootstrap's own output (pnpm install, migrations, seed) would corrupt the
# JSON Claude parses, so the whole checkout goes to the log.
if git rev-parse --verify "$branch" >/dev/null 2>&1; then
  git worktree add "$worktree_path" "$branch" >"$log" 2>&1 || fail "git worktree add failed for existing branch $branch — see $log"
else
  git worktree add -b "$branch" "$worktree_path" HEAD >"$log" 2>&1 || fail "git worktree add -b $branch failed — see $log"
fi

# git ignores post-checkout's exit status, so a half-finished bootstrap looks
# like a finished one. A bare worktree is still usable, so warn rather than
# abort — aborting would throw away a worktree that only needs `pnpm install`.
[ -d "${worktree_path}/node_modules" ] || echo "worktree created but not bootstrapped — run 'pnpm install && pnpm setup' in ${worktree_path} (log: ${log})" >&2

jq -n --arg p "$worktree_path" '{hookSpecificOutput: {hookEventName: "WorktreeCreate", success: true, worktreePath: $p}}'
