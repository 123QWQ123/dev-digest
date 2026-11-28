# Skill routing

The canonical routing is `../routing.json`, which the engine reads. This file explains it. Change routing
there, not here.

## How a file gets its skills

1. **Excluded** files are never reviewed by skills: lockfiles, `node_modules`, migration `meta/` snapshots,
   binaries/images, and all `*.md` except `docs/agent-prompts/**`. They still appear in the snapshot. If
   they change after a review, the gate ignores that.
2. **Path rules are additive.** Every rule whose `glob` matches, and whose `unless` doesn't, adds its
   skills.
3. **Content rules** add skills based on the file's content in the snapshot. Currently: any `.ts/.tsx`
   that imports `zod` gets `zod`.
4. In `--quick` mode only the `quickSkills` survive: onion-architecture, frontend-architecture, security,
   react-best-practices. These are the skills whose rubric can yield a critical.

| Area | Skills |
|---|---|
| `server/src/**` (not `vendor/shared`) | onion-architecture, typescript-expert, security |
| server routes, `app.ts`, `server.ts`, `platform/**` | + fastify-best-practices |
| `server/src/db/**`, repositories (`repository.ts`, `repository/**`, `*.repo.ts`) | + drizzle-orm-patterns |
| schema files, `db/migrations/*.sql` | + postgresql-table-design |
| `client/src/**` (non-test, not `vendor/shared`) | frontend-architecture, security |
| `client/src/**/*.tsx`, `client/src/lib/hooks/**` | + react-best-practices |
| `client/src/app/**`, `next.config.*`, `middleware.ts` | + next-best-practices |
| client tests | react-testing-library only |
| `*/src/vendor/shared/**` | zod, typescript-expert (+ `check-shared.sh` parity check) |
| `reviewer-core/src/**` | typescript-expert, security |
| `reviewer-core/test/**`, `e2e/**`, `server/test/**` | typescript-expert |

Files that match no rule are listed as "without a skill". The deterministic checks of their package still
cover them.

## Deterministic checks per touched package

| Package | Checks (run inside the package) |
|---|---|
| server | `pnpm arch:check`, `pnpm typecheck` |
| client | `pnpm arch:check`, `pnpm lint`, `pnpm typecheck` |
| reviewer-core | `npm run typecheck` (+ server checks, since server consumes it as source) |
| e2e | `npm run typecheck` |
| any `vendor/shared` change | `./scripts/check-shared.sh` (no `--fix`) |

## Skills that are not reviewers

`engineering-insights`, `mermaid-diagram` and `pr-self-review` itself are listed in `notReviewSkills`.
Any other directory in `.claude/skills/` that routing.json doesn't mention produces a **warning** in the
report. Add a rule for it, or list it in `notReviewSkills`.
