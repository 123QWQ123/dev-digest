---
name: onion-architecture
description: "Onion Architecture for the Node/TypeScript backend (Fastify 5 + Drizzle ORM + Zod): which ring a piece of code belongs to, what it may import, where routes, services (use cases), domain rules, ports/interfaces, repositories, adapters, transactions and DI wiring go, and how the dependency-cruiser layer rules (`pnpm arch:check`) enforce it. Use this whenever you create or change a backend module, route, service, repository, adapter, job or DB query in server/; when you move or extract backend logic; when `arch:check` fails; when you review a server PR for structure; or when the user asks 'where should this go', 'how should I structure this', or mentions onion / clean / hexagonal / ports and adapters / layers — even if they don't say 'architecture'. Not for the client (see frontend-architecture), Fastify API details (fastify-best-practices), query syntax (drizzle-orm-patterns) or schema design (postgresql-table-design)."
metadata:
  version: "1.1.0"
  updated: "2026-11-27"
  tags: onion-architecture, clean-architecture, hexagonal, fastify, drizzle, layering, dependency-cruiser, backend
---

# Onion Architecture (backend)

Answers two questions for `server/`: **which ring does this code live in, and what may it depend on?**
Rules are generic. **"In this repo"** notes map them onto DevDigest's `server/` — follow those when working
there. Numbers like `[1]` point to sources in [README.md](README.md).

**Related skills (don't duplicate them):** `fastify-best-practices` (routes, hooks, plugins API, schemas),
`drizzle-orm-patterns` (query/relation/migration syntax), `postgresql-table-design` (tables, indexes), `zod`
(schema authoring), `frontend-architecture` (the same question for `client/`).

**Load on demand:**
- [references/layers-and-placement.md](references/layers-and-placement.md) — full "where does X go" table,
  module anatomy, naming, what each ring may import, cross-module access.
- [references/fastify.md](references/fastify.md) — Fastify as the outer ring: thin routes, plugins &
  encapsulation, the composition root, DI without a container library, errors.
- [references/drizzle.md](references/drizzle.md) — Drizzle as infrastructure: repositories, row↔domain
  mapping, `$inferSelect` leakage, transactions / unit of work, testing.
- [references/enforcement.md](references/enforcement.md) — the dependency-cruiser rules, baseline workflow,
  reading and fixing an `arch:check` failure, what the tool cannot see.
- [references/examples.md](references/examples.md) — before/after refactors on real repo code.

---

## 1. The one rule: dependencies point inward

```
          ┌──────────────────────────────────────────────────────────┐
          │ EDGE   routes.ts · app.ts · platform/container.ts        │  Fastify, HTTP, DI wiring
          │  ┌────────────────────────────────────────────────────┐  │
          │  │ INFRA  repository.ts · src/db · src/adapters · jobs │  │  Drizzle, Octokit, LLM SDKs, fs
          │  │  ┌──────────────────────────────────────────────┐  │  │
          │  │  │ APP   service.ts (use cases)                 │  │  │  orchestration, tx boundaries
          │  │  │  ┌────────────────────────────────────────┐  │  │  │
          │  │  │  │ DOMAIN  domain.ts · ports.ts · shared  │  │  │  │  types, rules, interfaces
          │  │  │  └────────────────────────────────────────┘  │  │  │
          │  │  └──────────────────────────────────────────────┘  │  │
          │  └────────────────────────────────────────────────────┘  │
          └──────────────────────────────────────────────────────────┘
                      imports may only point toward the centre ──►
```

- Code may depend on rings **more central** than itself, never on rings further out. [1][3][4]
- **Inner rings define interfaces; outer rings implement them.** A service needs "something that loads a
  PR" → it declares/consumes an interface; the Drizzle repository implements it. [1][3]
- **The database is not the centre — it is external.** So is GitHub, the LLM, the filesystem, Fastify. [1][10]
- **The core must be runnable without infrastructure:** a service + domain should be testable with in-memory
  fakes and no Postgres, no network. [3]
- An outer ring may call **any** inner ring directly (no pass-through proxies "just to respect layers"). [3][4]
- Wiring happens in **one place, as close to the entry point as possible** — the composition root. [8]

Why: changes in volatile things (ORM, SDK versions, HTTP shape) stop rippling into business rules; the core
becomes cheap to test; each ring can be reasoned about alone.

> **In this repo:** the rings already exist in rough form. Ports for external I/O live in
> `src/vendor/shared/adapters.ts` (`LLMProvider`, `GitClient`, `GitHubClient`, `CodeIndex`, …); their
> implementations in `src/adapters/*`; test doubles in `src/adapters/mocks.ts`; the composition root is
> `src/platform/container.ts` (+ `src/app.ts`). Known gaps — SQL in routes, services taking the whole
> `Container` — were recorded in the baseline (§7); all import-level ones are fixed (baseline empty since
> 2026-11-27). Reference modules: `pulls/`, `settings/`, `workspace/` (routes → compose → service → repository).

## 2. Rings in DevDigest terms

| Ring | Contains | Files | May import |
|---|---|---|---|
| **Domain** | entity/value types, pure business rules, invariants, port interfaces | `modules/<m>/domain.ts` or `domain/`, `modules/<m>/ports.ts`, `modules/<m>/constants.ts`, `src/vendor/shared/**` (contracts + adapter ports) | other domain files, `zod`, `@devdigest/shared`, `@devdigest/reviewer-core` pure functions |
| **App** (use cases) | orchestration of one user intent, authorization/scoping, transaction boundary, mapping to DTO | `modules/<m>/service.ts`, `modules/<m>/helpers.ts`, flow classes like `reviews/run-executor.ts` | Domain, ports (as **types**), `platform/errors.ts` |
| **Infra** | Drizzle queries, row↔domain mapping, SDK/IO adapters, job runner, SSE bus | `modules/<m>/repository.ts` or `repository/*.repo.ts`, `src/db/**`, `src/adapters/**`, `platform/jobs.ts`, `platform/sse.ts` | Domain, ports, ORM, SDKs, `node:*` |
| **Edge** | HTTP routes, request validation, Fastify plugins, DI composition, boot | `modules/<m>/routes.ts`, `modules/<m>/compose.ts`, `modules/index.ts`, `src/app.ts`, `src/server.ts`, `platform/container.ts` | everything inward; **routes call services only** — they get the service from `compose.ts` |

`src/vendor/shared` is the innermost contract ring for the whole app (mirrored into `client/`), so it must
never import server code.

## 3. Hard rules

✅ = enforced by `pnpm arch:check` (dependency-cruiser, CI). 👀 = review-only (the tool can't see it).

1. ✅ **ORM only in infra.** `drizzle-orm`, `src/db/schema*` and `src/db/client.ts` are imported only by
   repositories (`repository.ts`, `repository/**`, `*.repo.ts`), `src/db/**`, `src/adapters/**` and the
   composition root. Anywhere else → move the query into the module's repository. [`onion-orm-only-in-infra`]
2. ✅ **Routes only call services.** `routes.ts` never imports a repository, `src/db/**` or `src/adapters/**`.
   [`onion-routes-only-call-services`]
3. ✅ **Domain is pure.** `domain.ts`, `domain/**`, `ports.ts`, `constants.ts` import no framework, ORM, SDK,
   `fs`/`child_process`/network module, and nothing from service/repository/routes/container.
   [`onion-domain-is-pure`]
4. ✅ **Adapters don't know features.** `src/adapters/**` imports nothing from `src/modules/**` except a
   module's `ports.ts`/`types.ts`/`domain`. Shared types move inward. [`onion-adapters-not-to-modules`]
5. ✅ **Platform doesn't know features** — only `platform/container.ts` may. [`onion-platform-not-to-modules`]
6. ✅ **No reaching into another module.** Use its public surface (`index.ts`, `types.ts`, `ports.ts`) or a
   dependency handed in by the container. [`onion-no-cross-module-internals`]
7. ✅ **`vendor/shared` is a leaf**, ✅ **no runtime import cycles**, ✅ **no unresolvable imports.**
8. 👀 **No `container.db` outside infra.** Routes and services must not run queries through
   `container.db` (dependency-cruiser sees imports, not property access).
9. 👀 **Services receive explicit dependencies**, typed as interfaces/ports, via the constructor — not the
   whole `Container` (that is a service locator). `Pick<Container, 'agentsRepo' | 'llm'>` is an acceptable
   step on the way (every module service already declares such an `XDeps` type). [5][8]
10. 👀 **Repositories return domain/contract types, not raw rows, across the service boundary** when the
    row shape differs from the domain shape. Mapping lives in the repository (or a `mappers.ts` next to it).
    `typeof table.$inferSelect` must never reach a `@devdigest/shared` contract or an HTTP response unmapped.
11. 👀 **Validate at the edge.** Route input via zod schemas on the route (`fastify-type-provider-zod`); the
    domain trusts already-validated, typed input. Zod in the domain only to *define* contracts.
12. 👀 **The service owns the transaction boundary**; the repository owns the `db.transaction` call.
    See [references/drizzle.md](references/drizzle.md) §4.
13. 👀 **Business rules are not in repositories or routes.** A `WHERE` that encodes a rule ("latest DONE run
    per agent") is fine in SQL, but decisions/derivations over results (status rollups, cost sums) are pure
    domain functions — like `pulls/status.ts` `totalPrCost`.

## 4. Where does X go?

| You are adding… | Put it in | Notes |
|---|---|---|
| New HTTP endpoint | `modules/<m>/routes.ts` | Parse/validate, call one service method, return. No SQL, no SDK calls |
| New feature area | `modules/<m>/{routes,compose,service,repository}.ts` + entry in `modules/index.ts` | Add `domain.ts`/`ports.ts` when there are rules/interfaces |
| Building a module's service (wiring) | `modules/<m>/compose.ts` — `createXService(container, log)` | The only module file that `new`s the repository; routes import it |
| Business rule / derivation (pure) | `modules/<m>/domain.ts` (or a named pure file like `status.ts`) | No I/O; unit-test without DB |
| Orchestration of one user intent | a `service.ts` method | Loads via repos/ports, applies domain rules, persists, emits events |
| SQL / Drizzle query | `modules/<m>/repository.ts` (split into `repository/<aggregate>.repo.ts` when large) | Return mapped types |
| Interface for a dependency the core needs | `modules/<m>/ports.ts`; cross-module/external I/O → `vendor/shared/adapters.ts` | Defined by the consumer (inner ring) |
| Call to GitHub / LLM / git / fs / ripgrep | an adapter in `src/adapters/<kind>/` behind a port | Plus a fake in `adapters/mocks.ts` |
| Wiring a new adapter/repo/service | `platform/container.ts` (+ `ContainerOverrides` for tests) | The only place that `new`s infra |
| Background work (clone/index/poll) | job via `platform/jobs.ts`, body in the module's service | Fire-and-forget → rejection handler |
| Request → response mapping (DTO) | `modules/<m>/helpers.ts` / service | Contracts from `@devdigest/shared` |
| Row ↔ domain mapping | next to the repository | Never in routes |
| Row type shared across modules | `src/db/rows.ts` | Type-only; not a license to return rows to HTTP |

Full table, module anatomy and import matrix: [references/layers-and-placement.md](references/layers-and-placement.md).

## 5. Pragmatism — don't over-onion

- Onion's value is the **direction of dependencies**, not the number of folders or interfaces. Palermo's own
  retrospective says it works without an IoC container. [3]
- **Don't add a port for a single implementation with no test need.** A repository *class* the service
  receives via constructor is already a seam: tests can pass a fake object of the same shape
  (`Pick<ReviewRepository, 'getPull'>`). Extract an explicit interface when a second implementation or an
  in-memory fake for unit tests is actually needed.
- **No pass-through layers.** If a service method would only forward to the repository, the route may still
  call the service (rule 2), but keep the method one line — don't invent a "manager" in between.
- Small CRUD modules may stay `routes + service + repository` with no `domain.ts`. Add domain files when a
  rule appears.

## 6. Checklists

**New module / endpoint**
- [ ] Route: zod-validated input, one service call, no `drizzle-orm`, no `container.db`, no SDK.
- [ ] Service: constructor takes the repos/ports it uses; no `drizzle-orm` import; owns tx boundary.
- [ ] Repository: all queries for the module's tables; workspace scoping in every query; returns mapped types.
- [ ] Pure rules in `domain.ts` with unit tests; external I/O behind a port with a mock in `adapters/mocks.ts`.
- [ ] Service built in `modules/<m>/compose.ts`; registered in `modules/index.ts`; shared wiring in `platform/container.ts`.
- [ ] `pnpm arch:check && pnpm typecheck` pass.

**Reviewing a server PR for structure**
- [ ] `arch:check` green **and** the baseline file did not grow (`git diff .dependency-cruiser-known-violations.json`).
- [ ] No new `container.db` in routes/services (`grep -n "container\.db" src/modules/*/{routes,service}.ts`).
- [ ] No new service taking `Container` where explicit deps were easy.
- [ ] No `$inferSelect` row returned straight from a route.
- [ ] Touched a baselined file? Prefer fixing the violation in the same PR, then `pnpm arch:baseline` (shrinks).

## 7. Enforcement & the baseline

- `pnpm arch:check` (also in CI, job `typecheck` of `server-unit.yml`) runs dependency-cruiser with
  `server/.dependency-cruiser.cjs` and `--ignore-known`: it fails **only on violations not in**
  `server/.dependency-cruiser-known-violations.json`.
- The baseline records debt that existed when the rules were introduced. It started at 23 violations and
  is **empty** since 2026-11-27 — keep it that way: a new violation is fixed, not baselined.
- **Never re-run `pnpm arch:baseline` to make a new violation go away.** Run it only after *removing*
  violations, so the file shrinks. A growing baseline in a diff is a review blocker.
- Details, rule-by-rule fixes and tool blind spots: [references/enforcement.md](references/enforcement.md).

## 8. Anti-patterns

| Smell | Why it hurts | Fix |
|---|---|---|
| SQL in a route (`container.db.select()…` in `routes.ts`) | HTTP shape and storage shape fused; untestable without Postgres | Repository method + service method |
| Service takes `Container` and pulls what it wants | Hidden dependencies (service locator); tests must build a whole container | Constructor params with narrow types |
| Repository decides business outcomes | Rules hidden in SQL glue; duplicated across queries | Return data; decide in domain/service |
| `$inferSelect` rows in API responses / shared contracts | DB column renames break the API; leaks internal fields | Map to contract in repository/helpers |
| Adapter importing a module's constants/types | Infra now depends on a feature → cycles, wrong direction | Move the constant/type inward (`vendor/shared` or the adapter's own file) |
| Interface for everything, `IFooService` with one impl | Ceremony without benefit [3][7] | Add ports where a seam is needed (I/O, tests) |
| `db.transaction` called in a service via `container.db` | Infra leaked into app ring | Repository exposes `withTransaction` / unit of work |
