# Insights — server
<!-- Maintained by the engineering-insights skill. Append-only: add bullets to the
     matching section, never edit or delete. Entry format:
     - YYYY-MM-DD · <specific lesson> — <why / fix> (`path:line`)
     Human review monthly: delete entries made stale by upgrades or deleted code,
     resolve contradictions. Versioned in git — revert a bad wrap-up there. -->

## What Works

## What Doesn't Work
- 2026-11-24 · Fire-and-forget `jobs.enqueue()` without a rejection handler crashed the API on a failed job (e.g. clone of a non-existent repo) — `done.catch(() => {})` in `JobRunner.enqueue`; failure is already persisted on the `jobs` row (`src/platform/jobs.ts:104`)

## Codebase Patterns
- 2026-11-24 · Run cost: `agent_runs.cost_usd` NULL = unknown (pre-M1 run, failed/cancelled, unpriced model) vs `0` = known free model — never coalesce to 0; the UI renders NULL as "—". PR-list COST = newest DONE run per agent, summed via the pure `latestRoundCost` (rows must be newest-first) (`src/modules/pulls/status.ts:72`)
- 2026-11-25 · Supersedes 2026-11-24 (PR-list COST): per user request COST is now the PR's **total spend** — the sum of the known `cost_usd` of every run (all agents, reruns included, no status filter or ordering needed) via pure `totalPrCost`; `latestRoundCost` is gone. NULL-vs-0 rule unchanged (`src/modules/pulls/status.ts:69`)

## Tool & Library Notes
- 2026-11-24 · `pnpm db:migrate` dumps Postgres NOTICE objects (`extension "vector" already exists`, `relation "__drizzle_migrations" already exists`) that look like errors — benign; success is the final `✓ migrations applied` line (`src/db/migrate.ts:45`)

## Recurring Errors & Fixes

## Session Notes
- 2026-11-24 · M1 run cost: persisted engine `costUsd` into `agent_runs.cost_usd` (migration 0010), exposed on RunSummary / RunStats / PrMeta

## Open Questions
