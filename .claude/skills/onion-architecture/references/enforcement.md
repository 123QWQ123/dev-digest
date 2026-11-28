# Enforcement — dependency-cruiser

The dependency rule is checked mechanically, as recommended for keeping layers honest inside a single
project [7][15][23]. Config: `server/.dependency-cruiser.cjs`. Rules are `forbidden` entries with `from`/`to`
path regexes; `$1` in a `to.pathNot` refers to the group captured in `from.path`. [21]

## 1. Commands (run inside `server/`)

| Command | What it does |
|---|---|
| `pnpm arch:check` | Cruises `src/`, fails (exit ≠ 0) on any violation **not** in the baseline. Runs in CI (`server-unit.yml`, job `typecheck`). |
| `pnpm exec depcruise src --config .dependency-cruiser.cjs --output-type err` | Same, but shows **all** violations incl. baselined ones. |
| `pnpm arch:baseline` | Rewrites `.dependency-cruiser-known-violations.json` from the current code. [22] |

## 2. Rules

| Rule | From | Forbidden to | Typical fix |
|---|---|---|---|
| `onion-orm-only-in-infra` | anything except repositories, `src/db/`, `src/adapters/`, `app.ts`, `server.ts`, `platform/container.ts` | `drizzle-orm`, `src/db/schema*`, `src/db/client.ts` | Move the query to `modules/<m>/repository.ts`; call it from the service |
| `onion-routes-only-call-services` | `modules/*/routes.ts` | repositories, `src/db/**`, `src/adapters/**` | Add/extend a service method |
| `onion-domain-is-pure` | `domain.ts`, `domain/**`, `ports.ts`, `constants.ts` | fastify, drizzle, postgres, octokit, openai, @anthropic-ai, simple-git, p-queue, ripgrep, ast-grep, `fs`/`child_process`/`net`/`http(s)`, `src/db`, `src/adapters`, container, service/repository/routes/run-executor | Pass data in as arguments; move I/O to infra |
| `onion-adapters-not-to-modules` | `src/adapters/**` | `src/modules/**` except a module's `ports`/`types`/`domain` | Move the constant/type into `vendor/shared` or the adapter |
| `onion-platform-not-to-modules` | `src/platform/**` except `container.ts` | `src/modules/**` | Invert: the module depends on platform, or the container wires it |
| `onion-no-cross-module-internals` | `modules/<a>/**` | `modules/<b>/**` except `index.ts`/`types.ts`/`ports.ts` and `_shared` | Export via `<b>/index.ts`, or get it from the container |
| `onion-vendor-shared-is-leaf` | `src/vendor/shared/**` | any other `src/**` | Contracts must be self-contained (mirrored to `client/`) |
| `no-circular` | any | runtime import cycles (type-only edges ignored) | Extract the shared piece inward |
| `not-to-unresolvable` | any | imports that don't resolve | Fix the path / alias |

Excluded from cruising: `src/db/migrations/**`, `*.test.ts`.

## 3. The baseline

- Created 2026-11-27 with **23 known violations** (all pre-existing) — **all fixed the same day; the
  baseline is now `[]`**. What they were (and how they were fixed), for reference:
  - SQL in routes: `pulls`, `settings`, `workspace`, `polling` (`routes.ts` → `drizzle-orm` / `db/schema`);
  - app-ring files importing schema: `settings/feature-models.ts`, `reviews/run-executor.ts`,
    `reviews/diff-loader.ts`, `repos/helpers.ts`;
  - `platform/jobs.ts` → `db/schema`, `db/client`, `drizzle-orm`;
  - `adapters/astgrep`, `adapters/depgraph` → `modules/repo-intel/constants.ts`;
  - `repos/service.ts` → `repo-intel/constants.ts`.
  Fixes: route → compose → service → repository split (pulls, settings, workspace; polling reuses the
  pulls service via `pulls/index.ts`), `RepoRow` type-only from `db/rows.ts`, a `JobStore` port in
  `platform/jobs.ts` implemented by `db/job-store.ts`, public constants re-exported from `repo-intel/types.ts`.
- `--ignore-known` lowers matching violations to `ignore`; anything new fails. [22]
- **The baseline only shrinks.** Workflow when you touch a baselined file:
  1. fix the violation (move the query / constant);
  2. `pnpm arch:baseline` — the entry disappears;
  3. commit the code fix and the smaller baseline together.
- Re-running `arch:baseline` to swallow a *new* violation is forbidden. In review, a diff that **adds**
  entries to `.dependency-cruiser-known-violations.json` is a blocker unless explicitly agreed.

## 4. Reading a failure

```
error onion-orm-only-in-infra: src/modules/agents/routes.ts → node_modules/drizzle-orm/index.d.ts
```
= rule name · importing file → imported file. Look the rule up in §2, apply the fix. Don't weaken the regex
to make one file pass; if a rule is genuinely wrong, change it in `.dependency-cruiser.cjs` **and**
SKILL.md §3 + this file in the same commit (MINOR/MAJOR bump per README).

## 5. What the tool cannot see (review these by hand)

- **Property access**: `container.db.select()` in a route or service imports nothing from `drizzle-orm`
  when the table objects come from elsewhere, so it can slip through. Grep:
  `grep -rn "container\.db" src/modules --include='*.ts' | grep -v repository`.
- **Service locator**: a service taking `Container` passes all import rules.
- **Row leakage**: `$inferSelect` types returned to HTTP are type-level, not an import violation.
- **Logic placement**: business decisions inside repositories or routes.
- Files whose names don't match the conventions (a pure file not named `domain.ts` isn't purity-checked).

## 6. Alternatives (not used here)

- ArchUnitTS — architecture rules as vitest tests. [25]
- fresh-onion — onion-specific checker for TS. [24]
dependency-cruiser was chosen because it is already a server dependency (used by repo-intel's dep graph)
and supports a baseline for incremental adoption.
