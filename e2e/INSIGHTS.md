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
- 2026-11-28 · `find text X click` clicks the FIRST DOM match and fails instantly ("is not visible, so the click would not reach it") if that match is hidden. next-intl serializes ALL `messages/en/*.json` into an invisible RSC `<script>` (`self.__next_f.push`), so any text that is also a message string (e.g. skills `form.namePlaceholder: "branch-coverage-gate"`) can be hit there — 08 failed in CI (fresh seed / CI DOM order) but passed locally. Click cards via `find testid <data-testid> click` instead (`specs/08-skills.flow.json`)
- 2026-11-27 · `agent-browser wait --text` matches rendered text, so a label styled `text-transform: uppercase` (Stats tiles/panel titles) never matches its source string — wait on a non-transformed text (footnote, row name) instead (`specs/08-skills.flow.json`)

## Recurring Errors & Fixes
- 2026-11-27 · `./scripts/e2e.sh` ends with `sh: tsx: command not found` (exit 127) after the whole stack came up: the script installs server/client deps but not `e2e/` — run `cd e2e && npm ci` once (`../scripts/e2e.sh:107`)

## Session Notes

## Open Questions
