# Layers and placement

Detailed companion to SKILL.md §2–§4. Load when you add a module, move code between files, or are unsure
what a file may import.

## 1. Module anatomy

A feature module is a folder under `server/src/modules/<m>/`. Grow it in this order — add a file only when
it has content:

```
modules/<m>/
  routes.ts          EDGE    Fastify plugin: validate → call service → return. Default export.
  compose.ts         EDGE    createXService(container, log): builds service + repository. Routes import this.
  service.ts         APP     Use cases. Class with constructor-injected deps.
  repository.ts      INFRA   Drizzle queries for this module's tables + row→domain mapping.
  repository/        INFRA   …split by aggregate when repository.ts grows: <aggregate>.repo.ts
  domain.ts          DOMAIN  Pure types + rules (or domain/ when it grows). No I/O.
  ports.ts           DOMAIN  Interfaces this module's service needs and someone else implements.
  constants.ts       DOMAIN  Pure constants. No imports from outer rings.
  helpers.ts         APP     DTO mapping, small pure helpers used by the service.
  index.ts           —       Public surface for OTHER modules (types, facade). Optional.
  types.ts           DOMAIN  Public types (repo-intel uses this for its `RepoIntel` facade interface).
  README.md                  For complex modules (repo-intel).
```

Flow-heavy modules may have extra app-ring files named after the flow (`reviews/run-executor.ts`,
`reviews/diff-loader.ts`, `repo-intel/pipeline/*`). They follow app-ring rules: no `drizzle-orm`, take
repositories/ports as dependencies.

> **In this repo:** `pulls/status.ts` is effectively the pulls module's `domain.ts` (pure
> `deriveReviewStatus`, `rollupSeverities`, `totalPrCost`). New pure rules may join it or go in `domain.ts`.
> Only files named `domain.ts`/`domain/`/`ports.ts`/`constants.ts` are checked by the purity rule, so prefer
> those names for new pure code.

## 2. Import matrix

Rows import columns. ✅ allowed · ❌ forbidden (tool) · ⚠️ forbidden (review) · — n/a

| from \ to | domain / ports / constants | vendor/shared | service / helpers | repository | src/db (schema, client) | drizzle-orm | src/adapters | SDKs, node:fs… | platform/errors | platform/container | fastify |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **domain** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **service** | ✅ | ✅ | ✅ (same module) | ✅ type / ctor param | ❌ | ❌ | ⚠️ via port | ⚠️ via port | ✅ | ⚠️ type only, prefer narrow deps | ⚠️ |
| **repository** | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⚠️ | ❌ |
| **routes** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ (via `app.container`) | ✅ |
| **adapters** | ✅ (ports/types only) | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **platform/** (not container) | ✅ | ✅ | ❌ | ❌ | ⚠️ (jobs is baselined) | ⚠️ | ✅ | ✅ | ✅ | — | ✅ |
| **container / app.ts** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **vendor/shared** | — | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ (zod only) | ❌ | ❌ | ❌ |

## 3. Where does X go? (full)

| Code | Goes in | Rule of thumb |
|---|---|---|
| HTTP route | `modules/<m>/routes.ts` | ≤ ~15 lines per handler: context, validate, one service call, return |
| Request/params schema | route `schema` (zod) — shared ones in `modules/_shared/schemas.ts` | Validation is an edge concern |
| API response / cross-package contract | `src/vendor/shared/contracts` (mirror to `client/`) | Inner-most; no server imports |
| Workspace/request context | `modules/_shared/context.ts` → pass `workspaceId` into services | Services never read `req` |
| Use case (one user intent) | `service.ts` method | Names a verb from the domain: `runReview`, `actOnFinding` |
| Multi-step flow with progress/events | dedicated app-ring class (`run-executor.ts`) | Takes repos/ports/bus in ctor |
| Pure decision/derivation | `domain.ts` / named pure file | Deterministic, unit-tested, no `await` |
| Domain constants (limits, enum lists) | `modules/<m>/constants.ts` | Needed by an adapter too? Move to `vendor/shared` or the adapter |
| Port (interface the core needs) | `modules/<m>/ports.ts`; external I/O ports → `vendor/shared/adapters.ts` | Owned by the consumer, not the implementer |
| SQL / Drizzle query | `repository.ts` / `repository/<aggregate>.repo.ts` | Every query scoped by `workspaceId` where the table has it |
| Row → domain/DTO mapping | repository or `helpers.ts` beside it | Keep `$inferSelect` inside infra/app |
| Row types shared across modules | `src/db/rows.ts` | Type-only imports |
| Transaction | started in repository (`withTransaction`), boundary chosen by service | See drizzle.md §4 |
| External SDK call (Octokit, OpenAI, Anthropic, simple-git, ripgrep, ast-grep) | `src/adapters/<kind>/` implementing a port | + mock in `adapters/mocks.ts` |
| Price/cost tables, model routing | `platform/price-book.ts`, `platform/model-router.ts` (cross-cutting infra) | Don't import feature modules |
| Background job | enqueue via `platform/jobs.ts`; job body = service method | Rejection handler mandatory |
| SSE/event publishing | `platform/sse.ts` bus, injected into the service | Service emits domain events, not HTTP frames |
| Wiring / lifetimes | `platform/container.ts` | Only place that `new`s adapters & shared repos |
| Test doubles | `src/adapters/mocks.ts`, `ContainerOverrides` | Fakes implement the port |

## 4. Cross-module access

Allowed, in order of preference:
1. **Through the container** — a shared repository/facade constructed in `platform/container.ts`
   (`container.agentsRepo`, `container.repoIntel`) and handed to the consumer.
2. **Through the other module's public surface** — `modules/<other>/index.ts`, `types.ts`, `ports.ts`.
3. **Shared contracts** — `@devdigest/shared`.

Forbidden (tool): importing another module's `service.ts`, `repository.ts`, `helpers.ts`, `constants.ts`, …

> **In this repo:** `repos/service.ts → repo-intel/constants.ts` is baselined. Fix by re-exporting the needed
> constant from `repo-intel/index.ts` (or moving it into `vendor/shared` if adapters also need it).

## 5. Naming

- `*.repo.ts` / `repository.ts` / `repository/` → recognised as infra by the rules. Don't name app-ring code
  `*.repo.ts`.
- `domain.ts` / `domain/` / `ports.ts` / `constants.ts` → checked for purity.
- `routes.ts` → checked as edge (must not reach repositories/db/adapters).
- Anything else in a module is treated as app ring for the ORM rule.
