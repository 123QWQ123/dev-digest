# e2e — @devdigest/e2e (agent-browser flows, npm)

## Commands
- Recommended: `./scripts/e2e.sh` (from repo root) — isolated, freshly seeded stack
  (Postgres :5433, API :3101, web :3100), torn down after. Never touches the dev DB.
- Against your running stack: `npm test` — only if the dev DB contains ONLY the seeded repo.
- One-time setup: `npm i -g agent-browser && agent-browser install`

## Where things are
- `specs/NN-name.flow.json` — EXECUTABLE flows (JSON list of agent-browser commands), not docs
- `run.ts` — runner (one shared browser session); `lib/assert.ts` — assertions
- `docs/specs/` — markdown specs for planned flows (NOT `specs/`, which the runner executes)
- Failure screenshots: `test-results/` (git-ignored)

## Gotchas
- Assertions = `wait --text` / `wait --url` (non-zero exit on timeout) + optional `assert.stdoutIncludes`.
- Deterministic locators only (`--url`, `--text`, `find role|text|label|testid`). Never the AI `chat` command.
  Click text that is also an i18n message string via `find testid` (see INSIGHTS: hidden RSC `<script>`).
- Flows read seeded data only: repo `acme/payments-api`, PR #482, built-in agents. No LLM calls, no keys.
- Flows 02/04/05 assume the seeded repo is the ONLY repo → fail on a normal dev DB.
- `{BASE}` in commands is replaced with `E2E_BASE_URL`.

## Use when
- Flow format, env knobs, running locally → read `README.md`
- Deciding what e2e should / shouldn't cover → read `../TESTING.md`
- Writing a new flow → read `docs/specs/`
- Before starting ANY work here → read `INSIGHTS.md` (mandatory)
