# Examples — before / after

Read this when you need a concrete pattern for a rule in SKILL.md. Examples use this repo's conventions
(`_components/<Name>/`, `styles.ts`, `@devdigest/ui`, `lib/hooks/<domain>.ts`). Names are illustrative.

## Contents
1. A route folder, fully laid out
2. Splitting a component that does too much
3. Pulling business logic out of JSX
4. Placing constants
5. Promoting a component to shared
6. Fixing import-boundary violations
7. Adding a new API call

---

## 1. A route folder, fully laid out

```
src/app/repos/[repoId]/pulls/
├── page.tsx                  # reads params/search, picks loading/error/empty/list, composes
├── constants.ts              # route-level: COLUMN_KEYS, SKELETON_ROWS
├── helpers.ts                # route-level pure functions (sorting, filter parsing)
├── styles.ts
├── _components/
│   ├── FilterBar/
│   │   ├── FilterBar.tsx
│   │   └── index.ts          # export { FilterBar } from "./FilterBar";
│   └── PRRow/
│       ├── PRRow.tsx
│       ├── PRRow.test.tsx
│       ├── styles.ts
│       └── index.ts
└── [number]/                 # child route, with its own _components/
```

## 2. Splitting a component that does too much

❌ One component with three reasons to change: header, list filtering and an empty state.

```tsx
export function FindingsPanel({ findings, verdict }: Props) {
  const [sev, setSev] = useState<Severity | "ALL">("ALL");
  const visible = findings.filter((f) => sev === "ALL" || f.severity === sev)
                          .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  return (
    <div>
      <div style={{ /* 30 lines of banner markup */ }}>{verdict.summary}</div>
      {/* 20 lines of filter chips */}
      {visible.length === 0 ? <div>{/* empty markup */}</div>
        : visible.map((f) => <div key={f.id}>{/* 40 lines of card markup */}</div>)}
    </div>
  );
}
```

✅ Domain-named children, a pure helper, and the state stays in the parent that owns it.

```
FindingsPanel/
├── FindingsPanel.tsx         # composes VerdictBanner + SeverityFilter + list
├── helpers.ts                # visibleFindings(findings, sev)  ← pure, tested
├── helpers.test.ts
├── constants.ts              # SEV_ORDER
└── _components/SeverityFilter/
(VerdictBanner, FindingCard are siblings in the route's _components/ because the route also uses them)
```

```tsx
export function FindingsPanel({ findings, verdict }: Props) {
  const [sev, setSev] = useState<SeverityFilterValue>("ALL");
  const visible = visibleFindings(findings, sev);          // derived in render, not in state
  return (
    <>
      <VerdictBanner verdict={verdict} />
      <SeverityFilter value={sev} onChange={setSev} />
      {visible.length === 0
        ? <EmptyState title={t("findings.empty")} />
        : visible.map((f) => <FindingCard key={f.id} finding={f} />)}
    </>
  );
}
```

## 3. Pulling business logic out of JSX

❌ Rules buried in a handler and in JSX conditions:

```tsx
<Button
  disabled={!(run.status === "done" && run.findings.some((f) => f.severity === "CRITICAL") && !pr.merged)}
  onClick={async () => { await fetch(`${API}/runs/${run.id}/rerun`, { method: "POST" }); refetch(); }}
/>
```

✅ The rule is a pure function, I/O lives in a mutation hook, and the component wires them together:

```ts
// helpers.ts — pure, unit-tested
export const canRerun = (run: RunSummary, pr: PrMeta) =>
  run.status === "done" && run.findings.some((f) => f.severity === "CRITICAL") && !pr.merged;
```
```ts
// src/lib/hooks/reviews.ts — data layer
export function useRerun(prId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api(`/runs/${runId}/rerun`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: reviewKeys.pr(prId) }),
  });
}
```
```tsx
const rerun = useRerun(pr.id);
<Button disabled={!canRerun(run, pr)} onClick={() => rerun.mutate(run.id)} />
```

## 4. Placing constants

```ts
// ❌ inside the component: recreated every render, invisible to tests
function VerdictBanner() { const COLORS = { PASS: "var(--ok)", FAIL: "var(--crit)" }; ... }

// ❌ a global src/constants.ts mixing SEV_COLOR, PAGE_SIZE, API_TIMEOUT, TAB_KEYS ...

// ✅ VerdictBanner/constants.ts — scoped, typed, with a fallback
export const VERDICT_COLOR: Record<Verdict, string> = { PASS: "var(--ok)", FAIL: "var(--crit)" };
export const VERDICT_COLOR_FALLBACK = "var(--text-muted)";
```

Where a constant goes as it gains consumers:
`VerdictBanner/constants.ts` → `[number]/constants.ts` (two components in the route) →
`src/lib/severity.ts` (hypothetical, once both the PR list and PR detail routes use it).

## 5. Promoting a component to shared

Trigger: a component that lives in one route's `_components/` is needed by a second route. The target shape
is what `src/components/run-cost/` looks like today (shared by the PR list, run timeline and trace drawer):

```
before: app/repos/[repoId]/pulls/[number]/_components/<Somewhere>/RunCostBadge.tsx
after:  src/components/run-cost/
        ├── RunCostBadge.tsx
        ├── helpers.ts        # formatCost — moved with it
        ├── helpers.test.ts
        └── index.ts
```

Steps: move the component **together with** its helpers, constants and tests. Replace route-specific
imports with props. Update all consumers to `@/components/run-cost`. Don't add options until a consumer
needs them.

## 6. Fixing import-boundary violations

```ts
// ❌ shared code importing from a route
// src/components/diff-viewer/CodeLine.tsx
import { SEV_COLOR } from "@/app/repos/[repoId]/pulls/[number]/_components/FindingCard/constants";
// ✅ move SEV_COLOR to src/lib/severity.ts. Both FindingCard and CodeLine import it from there.

// ❌ one route reaching into another route's private components
// src/app/agents/[id]/page.tsx
import { PRRow } from "@/app/repos/[repoId]/pulls/_components/PRRow";
// ✅ if agents really needs it, promote PRRow to src/components/ (example 5)

// ❌ reaching into a folder's internals from outside it
import { lineLabel } from "../FindingCard/helpers";
// ✅ export what's public from FindingCard/index.ts, or move lineLabel up if it's shared logic

// ❌ new aggregate barrel
// src/components/index.ts → export * from "./app-shell"; export * from "./diff-viewer"; ...
// ✅ import each folder's own entry: "@/components/diff-viewer"
```

## 7. Adding a new API call

1. Contract type: in `@devdigest/shared`, **both** copies (server and client, see the root CLAUDE.md).
2. Hook: the matching domain file in `src/lib/hooks/` (`reviews.ts`, `agents.ts`, …), built on `api` /
   `apiFetch`, with keys defined once for the domain.
3. Response shaping: in the hook (`select`) or a mapper beside it, never in the component.
4. Component: call the hook, render its states (`Skeleton` / `ErrorState` / `EmptyState` / data).
