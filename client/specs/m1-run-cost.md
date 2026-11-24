# M1 — Run cost badge (client)

## Goal
Show the cost of agent reviews in three places, from data the API already returns
(`server/specs/m1-run-cost.md`).

## Screens
1. **PR list**: a `COST` column between `STATUS` and `UPDATED`; value = `PrMeta.cost_usd`
   (latest review round). Compact: `$0.014`.
2. **Agent runs timeline** (PR detail): under the run time, `9 119 tok · $0.0013`,
   only for `status === "done"` runs. Tokens = `tokens_in + tokens_out`.
3. **Run trace drawer → Stats**: a `COST` tile between `TOKENS` and `FINDINGS`.

One component, `RunCostBadge` (`src/components/run-cost/`), with variants
`compact` (cost only) and `detailed` (tokens · cost).

## Formatting (`formatCost`)
| value | output |
|---|---|
| null / undefined | `—` |
| 0 | `$0.00` |
| < 0.01 | `$0.0013` (4 dp) |
| < 1 | `$0.014` (3 dp) |
| ≥ 1 | `$1.24` (2 dp) |

Missing data is always `—`, never `$0.00`.

## Non-goals
Verdict-banner cost line; cost of failed runs; totals across PRs.

## Acceptance criteria
- PR without reviews / only pre-M1 runs → `—` in the COST column.
- Done run with cost → `N tok · $X`; failed / running → nothing.
- Trace for a pre-M1 run → COST tile shows `—`.
