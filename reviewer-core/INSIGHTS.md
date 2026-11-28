# Insights — reviewer-core
<!-- Maintained by the engineering-insights skill. Append-only: add bullets to the
     matching section, never edit or delete. Entry format:
     - YYYY-MM-DD · <specific lesson> — <why / fix> (`path:line`)
     Human review monthly: delete entries made stale by upgrades or deleted code,
     resolve contradictions. Versioned in git — revert a bad wrap-up there. -->

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes
- 2026-11-28 · OpenRouter `/models` lists `:batch` variants (e.g. `anthropic/claude-haiku-5.5:batch`, ~65 of 440) that only the Batch API serves — chat/completions answers 404 "cannot be used with the chat/completions endpoint". `listModels` drops them via `isBatchOnly`, so neither the agent nor the Feature Models picker offers them; a workspace that already saved one must re-pick (`src/llm/openrouter.ts:139`)

## Recurring Errors & Fixes

## Session Notes

## Open Questions
- 2026-11-27 · AGENTS.md says "NO I/O here", but `OpenRouterProvider` lives in reviewer-core and calls `fetch` (`/models`, completions); server's container imports it from `@devdigest/reviewer-core`. Decide: move it to `server/src/adapters/llm/` (onion: adapters are infra) or document it as the one sanctioned exception (`src/llm/openrouter.ts:124`)
- 2026-11-27 · Resolved (supersedes the 2026-11-27 OpenRouter question): keep `OpenRouterProvider` in reviewer-core — the CI runner (GitHub Action) runs this package directly and needs it, so moving it to server/adapters would break CI. Onion-wise it's fine: `review/run.ts` never imports it, the provider is injected; documented as the one sanctioned adapter in AGENTS.md (`src/llm/openrouter.ts:12`)
