# Insights — client
<!-- Maintained by the engineering-insights skill. Append-only: add bullets to the
     matching section, never edit or delete. Entry format:
     - YYYY-MM-DD · <specific lesson> — <why / fix> (`path:line`)
     Human review monthly: delete entries made stale by upgrades or deleted code,
     resolve contradictions. Versioned in git — revert a bad wrap-up there. -->

## What Works

## What Doesn't Work
- 2026-11-24 · Running `pnpm build` while `next dev` is up corrupts the dev server — both write `client/.next`, so pages die with `Cannot find module './vendor-chunks/<lib>.js'`. Fix: stop the dev stack, `rm -rf client/.next`, restart `./scripts/dev.sh`; to verify a build, stop `next dev` first (`client/.next`)

## Codebase Patterns
- 2026-11-25 · `@devdigest/ui` has no Popover/Tooltip/HoverCard primitive — the hover popover is hand-rolled: a `position:relative` wrapper with mouse/focus handlers, an absolute panel that uses `paddingTop` (not `marginTop`) so the hover area has no gap, a ~120 ms close delay, and Esc to close. Reuse it rather than building another one (`src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/SeverityCountPopover.tsx`)
- 2026-11-25 · The PR-list table card (`s.tableCard`) is deliberately `overflow: visible` — with `hidden` the FINDINGS hover popover under the last row is clipped (a 1-PR list shows nothing). Corner rounding moved to the last row (`s.row(hover, last)`); don't restore `overflow: hidden` (`src/app/repos/[repoId]/pulls/styles.ts`)
- 2026-11-27 · React Query keys live only in `lib/hooks/keys.ts` (`queryKeys.*`); pages never call `useQueryClient` — invalidation is a hook (`useRunStateInvalidation`). `providerModels(p)` ≠ `providerModelsAll()` (2-element key vs prefix), kept identical to the old literals; `keys.test.ts` pins them (`src/lib/hooks/keys.ts`)
- 2026-11-27 · UI code imports `ApiError` from `@/lib/api-error`, never `@/lib/api` — `fe-api-client-only-via-hooks` forbids app/components → `lib/api.ts` so data access stays in `lib/hooks/*` (`src/lib/api-error.ts`)

## Tool & Library Notes
- 2026-11-24 · jest-dom `toHaveTextContent` normalizes whitespace, so it fails on strings with a narrow no-break space (`\u202F`, used as the thousands separator by `formatTokenCount`) — assert `el.textContent` with `toBe` instead (`src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx:81`)
- 2026-11-24 · Supersedes 2026-11-24 (`toHaveTextContent`/`\u202F`): prefer `screen.getByText("9 119 tok · $0.0013")` with a plain space — RTL's default normalizer folds `\s+` (incl. `\u202F`) to one space, so no `data-testid` or `textContent` workaround is needed (`src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx`)
- 2026-11-25 · `pnpm vitest run "src/app/repos/[repoId]/..."` reports "No test files found": vitest treats the `[...]` in Next dynamic-route paths as a glob/regex, and escaping doesn't help. Filter by file name instead: `pnpm vitest run RunHistory` (`client/src/app/repos/[repoId]/pulls/[number]/_components/`)
- 2026-11-27 · client has no ESLint config at all, so `react-hooks/exhaustive-deps` and `rules-of-hooks` are never checked; existing `// eslint-disable-line react-hooks/exhaustive-deps` comments are dead text, not suppressions. Only `tsc` + vitest gate the code (`src/app/agents/[id]/_components/AgentEditor/_components/ConfigTab/ConfigTab.tsx:39`)
- 2026-11-27 · Supersedes 2026-11-27 (no ESLint): `pnpm lint` now runs ESLint 9 flat config (`next/core-web-vitals` + `next/typescript` via FlatCompat) in CI, plus `no-restricted-syntax` (no `export *`) and `no-restricted-imports` (no `../../../`, use `@/`); `pnpm arch:check` (dependency-cruiser) guards import boundaries (`eslint.config.mjs`)

## Recurring Errors & Fixes
- 2026-11-25 · `MISSING_MESSAGE: Could not resolve prReview.x` right after adding a key to `messages/en/*.json` while `next dev` runs — not a code bug: `loadMessages` reads the JSON with `readFileSync`, outside the webpack graph, so HMR hot-swaps the component but the open tab keeps the old messages. Fix: full page reload; confirm with `curl -s 127.0.0.1:3000/ | grep <key>` (`src/i18n/request.ts:16`)
- 2026-11-25 · `pnpm typecheck` while `next dev` is running can fail with `.next/types/routes.d.ts is not a module` / `Cannot find name 'LayoutProps'`. `tsconfig` includes `.next/types`, and the dev server was rewriting those files mid-check. This is transient and not caused by the source: re-run it. Only errors outside `.next/` are real (`client/.next/types/validator.ts`)
- 2026-11-25 · jsdom doesn't implement `Element.scrollIntoView`, so a component that scrolls on mount or in an effect throws `scrollIntoView is not a function` in vitest. Call it as `el.scrollIntoView?.(...)` (or stub `Element.prototype.scrollIntoView` in the test) (`src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx`)

- 2026-11-25 · React warning "Updating a style property during rerender (borderColor) when a conflicting property is set (borderLeftColor)" — `borderColor` and `borderWidth` are shorthands too (all 4 sides), not just `border`. Fix: per-side longhands (`borderTopColor`… `borderLeftColor`) whenever one side differs and a value toggles on rerender (`src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/styles.ts:5`)

## Session Notes
- 2026-11-24 · M1 run cost badge: shared `RunCostBadge`/`formatCost` in `src/components/run-cost/` used by the PR list, run timeline, and trace drawer
- 2026-11-25 · Timeline critical/warning counters with severity-filtered hover popovers; findings come from `usePrReviews`, grouped by `run_id` in FindingsTab (`specs/m1-timeline-severity-popover.md`)
- 2026-11-25 · PR list FINDINGS column: counts from `PrMeta.latest_review`, findings lazy-fetched on hover, deep link `?tab=findings&run=&finding=` read by FindingsTab `initialTarget` (`specs/m1-timeline-severity-popover.md`)
- 2026-11-25 · Supersedes the FINDINGS-column note above: counts are the **latest round** (`PrMeta.latest_round`, newest review of EVERY agent, older reruns dropped), not the single latest review; each finding deep-links into its own run (`src/app/repos/[repoId]/pulls/_components/PrFindingsCell/PrFindingsCell.tsx`)
- 2026-11-25 · Timeline got a SUGGESTION counter (💡 N) — `SeverityCountPopover` now takes `CountedSeverity` with a per-severity `labelKey`

## Open Questions
