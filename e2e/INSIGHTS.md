# Insights — e2e
<!-- Maintained by the engineering-insights skill. Append-only: add bullets to the
     matching section, never edit or delete. Entry format:
     - YYYY-MM-DD · <specific lesson> — <why / fix> (`path:line`)
     Human review monthly: delete entries made stale by upgrades or deleted code,
     resolve contradictions. Versioned in git — revert a bad wrap-up there. -->

## What Works

## What Doesn't Work
- 2026-11-27 · Running `scripts/e2e.sh` while the dev stack is up: its `next dev` runs in the same `client/` dir and shares `client/.next` with the dev server (corrupts it), and the dev Postgres may already own the default port 5433. Use `E2E_PG_PORT=5440 E2E_API_PORT=3201 E2E_WEB_PORT=3200` and, with dev running, start web from a copy of client/ (rsync without `.next`, symlink `node_modules`) (`../scripts/e2e.sh:148`)

## Codebase Patterns
- 2026-11-27 · A flow must `wait --text <row title>` before `find text <row title> click`: `wait --url /pulls` fires before the PR list has fetched, so 04/05 failed on every run (also on untouched HEAD) with `find text … click` — added the wait like 02 has (`specs/04-pr-findings.flow.json`)

## Tool & Library Notes

## Recurring Errors & Fixes
- 2026-11-27 · `./scripts/e2e.sh` ends with `sh: tsx: command not found` (exit 127) after the whole stack came up: the script installs server/client deps but not `e2e/` — run `cd e2e && npm ci` once (`../scripts/e2e.sh:107`)

## Session Notes

## Open Questions
