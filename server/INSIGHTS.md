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
- 2026-11-27 · Modules are route → `compose.ts` → service → repository; `compose.ts` (`createXService(container, log)`) is the only module file that builds the repository, because `onion-architecture`'s depcruise rule forbids routes importing repositories. Cross-module reuse goes through `<m>/index.ts` (polling uses `createPullsService`). Arch baseline is `[]` — fix, don't baseline (`src/modules/pulls/compose.ts`)

## Tool & Library Notes
- 2026-11-24 · `pnpm db:migrate` dumps Postgres NOTICE objects (`extension "vector" already exists`, `relation "__drizzle_migrations" already exists`) that look like errors — benign; success is the final `✓ migrations applied` line (`src/db/migrate.ts:45`)
- 2026-11-27 · dependency-cruiser here is 17.4.3: record the arch baseline with the `depcruise-baseline` bin (= `-T baseline -f .dependency-cruiser-known-violations.json`); the `--baseline` flag in upstream main-branch docs is 18.3+ and doesn't exist yet. Baseline paths are repo-relative (`src/...`), so it works in CI (`package.json:13`)
- 2026-11-27 · `src/adapters/depgraph/index.ts` contains NUL bytes, so the Edit/Write tools refuse it and grep treats it as binary — change it with `perl -pi` (keeps the bytes) and verify with `git diff --stat` (`src/adapters/depgraph/index.ts:20`)
- 2026-11-27 · `test/` was never type-checked (vitest strips types): tests imported a non-existent `src/domain/ports/*` and still passed. `pnpm typecheck` now also runs `tsc -p tsconfig.test.json` — a test type error now fails CI (`package.json:11`)

## Recurring Errors & Fixes
- 2026-11-27 · Moving a tolerant `Schema.parse(req.body ?? {})` into `schema: { body }` turned an empty-body POST from 400 into 422: with fastify-type-provider-zod a missing body reaches the validator as `null`, so `Schema.default({})` never applies. Use `z.preprocess((v) => v ?? {}, Schema)` (`src/modules/reviews/routes.ts:21`)

## Session Notes
- 2026-11-24 · M1 run cost: persisted engine `costUsd` into `agent_runs.cost_usd` (migration 0010), exposed on RunSummary / RunStats / PrMeta
- 2026-11-27 · Onion Architecture: added `onion-architecture` skill + `.dependency-cruiser.cjs` layer rules, `pnpm arch:check` in CI; 23 pre-existing violations baselined
- 2026-11-27 · Onion refactor: pulls/settings/workspace/polling split into service+repository (PR detail replace now one transaction — was a data-loss bug), JobStore port for JobRunner, `Pick<Container>` deps on all services, response schemas on pulls/settings, arch baseline 23 → 0

## Open Questions
