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
- 2026-11-27 · Services never get `db`: the repository is a 2nd ctor arg `new XService(deps, repo)` built in `<m>/compose.ts` (or `container.agentsRepo`/`reviewRepo`). Don't fold it into an object spread of the container — `codeIndex`/`depgraph`/`tokenizer`/`repoIntel` are lazy class getters and `{...container}` drops them. Tests pass a stub repo as the 2nd arg instead of overwriting `service.repo` (`src/modules/repo-intel/compose.ts`)
- 2026-11-27 · Values an adapter needs (e.g. `SUPPORTED_EXT`, `MAX_SIGNATURE_CHARS`) live in `vendor/shared/adapters.ts` next to the port; a module's `constants.ts` re-exports them. Re-exporting a module constant through `types.ts` only hides the adapter→module dependency from `arch:check` (`src/vendor/shared/adapters.ts:231`)
- 2026-11-27 · A skill reaches the prompt only if link enabled AND skill enabled — always go through `AgentsRepository.effectiveSkills` (executor + `skill_count`), never `linkedSkills`, which returns unticked/globally-disabled links too. Skills are deliberately NOT `<untrusted>`-wrapped; trust is gated at import (server-side preview, non-md entries only listed, explicit confirm) (`src/modules/agents/repository.ts:213`)
- 2026-11-27 · Before inventing a contract, grep `vendor/shared/contracts/` — later milestones are pre-declared there (e.g. M7 `AgentStats` for `GET /agents/:id/stats` in `observability.ts`, `eval_cases.owner_kind='skill'`). A same-named new schema in another contract file breaks `index.ts` `export *` with TS2308 (`src/vendor/shared/contracts/observability.ts:96`)
- 2026-11-28 · A module that calls `llm.completeStructured` directly must wrap it: a provider error (429 no credits, timeout, bad JSON) otherwise reaches the global handler as 500 `internal_error`. Rethrow non-`AppError`s as `ExternalServiceError` (502) with the provider message (`src/modules/conventions/service.ts:178`)
- 2026-11-28 · Feature-model lookup from another module goes through `settings/index.ts` → `createFeatureModelResolver(container)` (built in `settings/compose.ts`); importing `settings/feature-models.ts` or its repository breaks `onion-no-cross-module-internals` (`src/modules/settings/compose.ts:19`)
- 2026-11-28 · Skills with a server-forced `type`/`source` (e.g. `extracted`) use a dedicated service method (`SkillsService.createExtracted`, exported via `skills/index.ts`), not a wider `CreateSkillInput.source` — the public `POST /skills` must not let a client claim `extracted` (`src/modules/skills/service.ts:86`)

## Tool & Library Notes
- 2026-11-24 · `pnpm db:migrate` dumps Postgres NOTICE objects (`extension "vector" already exists`, `relation "__drizzle_migrations" already exists`) that look like errors — benign; success is the final `✓ migrations applied` line (`src/db/migrate.ts:45`)
- 2026-11-27 · dependency-cruiser here is 17.4.3: record the arch baseline with the `depcruise-baseline` bin (= `-T baseline -f .dependency-cruiser-known-violations.json`); the `--baseline` flag in upstream main-branch docs is 18.3+ and doesn't exist yet. Baseline paths are repo-relative (`src/...`), so it works in CI (`package.json:13`)
- 2026-11-27 · `src/adapters/depgraph/index.ts` contains NUL bytes, so the Edit/Write tools refuse it and grep treats it as binary — change it with `perl -pi` (keeps the bytes) and verify with `git diff --stat` (`src/adapters/depgraph/index.ts:20`)
- 2026-11-27 · `test/` was never type-checked (vitest strips types): tests imported a non-existent `src/domain/ports/*` and still passed. `pnpm typecheck` now also runs `tsc -p tsconfig.test.json` — a test type error now fails CI (`package.json:11`)
- 2026-11-28 · `MockGitClient.readFile` returns `''` for an unknown path while the real `SimpleGitClient.readFile` throws (realpath ENOENT) — code reading optional files (configs) must treat BOTH an empty string and a throw as "missing" or tests and prod diverge (`src/adapters/mocks.ts:293`)

## Recurring Errors & Fixes
- 2026-11-27 · Moving a tolerant `Schema.parse(req.body ?? {})` into `schema: { body }` turned an empty-body POST from 400 into 422: with fastify-type-provider-zod a missing body reaches the validator as `null`, so `Schema.default({})` never applies. Use `z.preprocess((v) => v ?? {}, Schema)` (`src/modules/reviews/routes.ts:21`)

## Session Notes
- 2026-11-24 · M1 run cost: persisted engine `costUsd` into `agent_runs.cost_usd` (migration 0010), exposed on RunSummary / RunStats / PrMeta
- 2026-11-27 · Onion Architecture: added `onion-architecture` skill + `.dependency-cruiser.cjs` layer rules, `pnpm arch:check` in CI; 23 pre-existing violations baselined
- 2026-11-27 · Onion refactor: pulls/settings/workspace/polling split into service+repository (PR detail replace now one transaction — was a data-loss bug), JobStore port for JobRunner, `Pick<Container>` deps on all services, response schemas on pulls/settings, arch baseline 23 → 0
- 2026-11-27 · pr-self-review follow-up: repos/reviews/agents/repo-intel got `compose.ts` (no `db` in service deps), adapter constants moved to shared, `POST /pulls/:id/review` response schema, single-statement settings upsert, PR+repo JOIN
- 2026-11-27 · M2 Skills: `skills` module (CRUD, append-only versions + restore, `.md/.zip` import preview via fflate, in memory), `PUT /agents/:id/skills` transactional + workspace-guarded, migration 0011, Test Quality Reviewer + 3 seeded skills (`specs/m2-skills.md`)
- 2026-11-27 · M2 stats: `run_skills` table (migration 0012) written by the executor; `GET /skills/:id/stats`, `GET /agents/:id/stats` (M7 contract), card `stats` on list endpoints, `POST /tokens/count` (tokens module) for the editors
- 2026-11-28 · M2 Conventions Extractor: `conventions` module (sample by code → 1 structured call → pure `domain/verify.ts` grounding → replace non-accepted rows), migration 0014 (evidence lines, created_at), in-process per-repo 409 lock, `POST /repos/:id/conventions/skill` → `convention`/`extracted` skill (`specs/m2-conventions.md`)

## Open Questions
- 2026-11-28 · `skills.it.test.ts` "a review renders only effective skills…" failed once in a full `pnpm test` with `trace.prompt_assembly` undefined (`:305`), passed in isolation and on rerun — likely the trace read races the run under parallel testcontainers load; `waitForPrRuns` returning `done` may precede the trace write (`test/skills.it.test.ts:305`)
