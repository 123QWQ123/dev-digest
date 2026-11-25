# reviewer-core — @devdigest/reviewer-core (pure TS engine, npm)

Pipeline: inputs → assemblePrompt (+ INJECTION_GUARD) → injected LLMProvider → structured output → groundFindings → Review.

## Commands
`npm test` (vitest, stubbed LLM, no keys/network) · `npm run typecheck` (= build; package never emits JS)

## Where things are
- `src/prompt.ts` — prompt assembly, `wrapUntrusted`, `INJECTION_GUARD`
- `src/grounding.ts` — citation gate vs the diff
- `src/llm/structured.ts` — Zod → JSON Schema, parse-with-repair; `src/llm/openrouter.ts` — OpenRouter provider
- `src/review/run.ts` — orchestration; `src/review/reduce.ts` — map-reduce merge
- `src/index.ts` — public API (server imports only from here)

## Gotchas
- NO I/O here: no DB, fs, GitHub, env. The only side effect is the injected LLMProvider.
- Consumed by server as TS source (tsconfig alias). Breaking an export breaks server typecheck.
- Uses npm (package-lock.json), unlike server/client.
- Optional prompt slots (skills, memory, specs, callers) and reduce/toReview exist for later milestones;
  absent slots must leave the prompt unchanged.
- Contracts (Review, Finding, Verdict) come from server/src/vendor/shared.

## Do not touch without discussion (security-critical)
- INJECTION_GUARD semantics — untrusted content is data; "intentional/test/do not flag" never descopes.
  Don't replace with keyword filtering.
- Grounding: findings citing lines not in the diff are dropped; score is recomputed from survivors,
  never taken from the model.

## Use when
- Pipeline, public API → read `README.md`
- What context the server feeds into the prompt → read `../server/README.md` (section "Review context")
- Writing tests → read `../TESTING.md`
- Implementing a feature → read `specs/`
- Design decisions, ADRs → read `docs/`
- Before starting ANY work here → read `INSIGHTS.md` (mandatory)
