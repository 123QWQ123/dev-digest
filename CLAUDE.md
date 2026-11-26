# DevDigest

Local-first AI PR review. Starter scope: add repo → import PR → agent review → grounded findings.
Roadmap milestones M1–M8 (README.md) add features back one by one.

4 independent packages — NO workspace, each has its own lockfile. Run commands inside the package.

## Stack
Node ≥22 · TypeScript · Zod 3 · Postgres 16 + pgvector (the only thing in Docker)
- server: Fastify 5 + Drizzle ORM (pnpm)
- client: Next.js 15 + React 19 + TanStack Query (pnpm)
- reviewer-core: pure TS review engine (npm)
- e2e: agent-browser flows (npm)

## Map
| Path | What |
|---|---|
| server/ | API :3001, DB, jobs, repo-intel indexer |
| client/ | Web studio :3000 |
| reviewer-core/ | diff → prompt → LLM → grounded findings |
| e2e/ | deterministic browser flows |
| scripts/ | dev.sh (full stack), e2e.sh (hermetic e2e) |
| docs/agent-prompts/ | built-in agent system prompts |

## Commands
- Full stack from zero: `./scripts/dev.sh` (flags: --no-seed --no-client --db-only)
- Per package: `typecheck` · `test` (pnpm in server/client, npm in reviewer-core/e2e)

## Cross-package gotchas
- `@devdigest/shared` is COPIED: server/src/vendor/shared AND client/src/vendor/shared
  (tsconfig path alias, not a package). Copies have already drifted. Contract change → update both.
- reviewer-core is consumed by server as TS source via path alias; it never emits JS.
- DB schema already holds tables for the whole roadmap; empty tables are intentional.
- API has no auth by design (local-only). Never expose it beyond 127.0.0.1.
- Never `docker compose down -v` — deletes the dev DB volume with all imported data.

## Use when
- Stack, roadmap, system architecture, how to run → read `README.md`
- Working inside a package → read that package's CLAUDE.md: `server/CLAUDE.md`, `client/CLAUDE.md`,
  `reviewer-core/CLAUDE.md`, `e2e/CLAUDE.md`
- Touching the review pipeline (prompt, LLM, grounding) → read `reviewer-core/README.md`
- Adding or changing an API route / contract → read `server/README.md` (sections "API map", "Request & DI flow")
- Implementing a feature → read its spec in `<pkg>/specs/` (e2e: `e2e/docs/specs/`); write one if missing
- Adding or changing tests, CI → read `TESTING.md`
- Agent prompt templates, model choice → read `docs/agent-prompts/`

## Session protocol (mandatory)
- START: before any work, read the INSIGHTS.md of the module you'll work in: `client/`, `server/`
  (incl. repo-intel), `reviewer-core/`, `e2e/`. Treat it as high-confidence guidance.
- END: invoke the `engineering-insights` skill. Write ONLY if there is something substantive AND it is not
  already recorded (check the file first). Nothing substantive or already there → write nothing.
  But if something substantive was learned, recording it is not optional.
