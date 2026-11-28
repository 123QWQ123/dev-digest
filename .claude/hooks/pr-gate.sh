#!/usr/bin/env bash
# Claude Code PreToolUse hook (matcher: Bash). Blocks `gh pr create` / `git push`
# unless the pr-self-review verdict is PASS for the content being pushed.
# Exit 2 = block (stderr goes to Claude). Logic lives in prsr.mjs `hook`.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
exec node .claude/skills/pr-self-review/scripts/prsr.mjs hook
