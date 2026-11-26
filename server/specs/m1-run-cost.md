# M1 — Run cost (server)

## Goal
Persist what each agent run cost (USD) and expose it to the client: per run
(timeline, trace) and per PR (PR list). Zero extra model calls — the engine
already returns `costUsd` (`reviewer-core` `reviewPullRequest` → OpenRouter
`usage.cost`, else `PriceBook`/`estimateCost` fallback, `null` for unknown models).

## Scope / Non-goals
- In: `agent_runs.cost_usd`, `RunSummary.cost_usd`, `RunStats.cost_usd`, `PrMeta.cost_usd`.
- Out: backfilling old runs; cost of failed/cancelled runs (partial spend is not tracked);
  embeddings / repo-intel cost; budgets or alerts.

## Behaviour
- On a successful run, `run-executor` stores `outcome.costUsd` in `agent_runs.cost_usd`
  and in `run_traces.trace.stats.cost_usd`.
- Failed / cancelled / pre-work failures store `cost_usd = NULL`.
- `null` means "unknown"; `0` means "known free model". They must not be conflated.
- `GET /pulls/:id/runs` → every `RunSummary` carries `cost_usd` (nullable).
- `GET /runs/:id/trace` → `stats.cost_usd` (nullish: traces written before M1 lack it).
- `GET /repos/:id/pulls` → `PrMeta.cost_usd` = **total spend on the PR**: the sum of
  the non-null `cost_usd` of every run of the PR (all agents, reruns included).
  No known cost → `null`. Pure helper `totalPrCost` in `modules/pulls/status.ts`.

## Acceptance criteria
- A new done run has a non-null `cost_usd` when the provider reports one.
- Old runs return `cost_usd: null`; old traces still parse.
- PR cost is the sum of all runs' known costs (reruns included); unknown costs are skipped.
- Migration is additive (nullable column), no existing migrations edited.
