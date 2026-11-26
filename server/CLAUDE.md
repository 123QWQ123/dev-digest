# server — @devdigest/api (Fastify 5 + Drizzle, pnpm)

## Commands
- dev `pnpm dev` (:3001) · `pnpm typecheck` · `pnpm test` (unit + integration)
- unit only: `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- integration only: `pnpm exec vitest run .it.test` (needs Docker, testcontainers)
- DB: `pnpm db:migrate` · `pnpm db:seed` (idempotent) · `pnpm db:generate` (new migration)

## Where things are
- `src/modules/<name>/{routes,service,repository}.ts` — one Fastify plugin per feature
- `src/modules/index.ts` — static module registry
- `src/platform/container.ts` — DI composition root; `src/adapters/` — external I/O
- `src/adapters/mocks.ts` — test doubles (MockLLMProvider, MockGitClient, …)
- `src/modules/reviews/run-executor.ts` — the review flow (diff → repo-intel context → reviewer-core → persist)
- `src/modules/repo-intel/` — indexer + facade; `src/db/schema/` — Drizzle tables

## Gotchas
- New module → add import + entry in modules/index.ts (no autoload, despite the dependency).
- Route input is validated by zod schemas on the route (fastify-type-provider-zod) — don't hand-parse req.body.
- Any test importing test/helpers/pg.ts MUST be named `*.it.test.ts`.
- Migrations don't run on boot.
- Clone/index/poll go through platform/jobs.ts (p-queue + `jobs` table). Reviews run fire-and-forget
  outside JobRunner; orphaned `running` runs are reaped on boot.
- Any fire-and-forget promise needs a rejection handler (unhandled rejection kills the API).
- platform/{grounding,structured,prompt}.ts are re-export shims → change reviewer-core instead.
- Secrets only via SecretsProvider (~/.devdigest/secrets.json, env fallback). Never store in DB.
- After saving a key, call `container.invalidateSecretCaches()`.

## Do not touch without discussion
- platform/local-only.ts — DNS-rebinding guard for the unauthenticated API
- Existing files in src/db/migrations/ — generate new ones instead
- vendor/shared — mirror every change in client/src/vendor/shared

## Use when
- API map, request/DI flow, env vars, what goes into the review prompt → read `README.md`
- Touching indexing, repo map, file rank, callers → read `src/modules/repo-intel/README.md`
- Writing tests → read `../TESTING.md`
- Implementing a feature → read `specs/`
- Design decisions, ADRs → read `docs/`
- Before starting ANY work here → read `INSIGHTS.md` (mandatory)
