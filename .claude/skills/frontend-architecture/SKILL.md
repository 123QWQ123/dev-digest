---
name: frontend-architecture
description: "Where code goes in a React / Next.js App Router frontend: component placement and splitting, where constants, helpers/utils, types, hooks and business logic live, the data-access layer, import boundaries, barrel files, and Next.js server/client and route-level architecture. Use this whenever you create a new component, page, hook, helper or constants file in client code; when you move, extract, split or refactor frontend code; when you review a PR for structure; or when the user asks 'where should this go', 'how should I organize/structure this', 'should this be shared', or about folder structure — even if they don't say 'architecture'. Not for React performance, hooks misuse or styling (see react-best-practices / next-best-practices)."
metadata:
  version: "1.0.0"
  updated: "2026-11-27"
  tags: react, nextjs, architecture, folder-structure, colocation, frontend
---

# Frontend Architecture

Answers one question for React + Next.js (App Router) code: **where does this code go, and what may it
depend on?** Rules are generic. The **"In this repo"** notes map them onto DevDigest's `client/`, which is
what you should follow when working there.

Numbers like `[15]` point to the sources in [README.md](README.md). Read a source only if you need the
reasoning behind a rule.

**Related skills (don't duplicate them):** `react-best-practices` covers hooks misuse, state anti-patterns
and render performance. `next-best-practices` covers Next.js file-convention reference, RSC serialization
rules, images, fonts and bundling.

**Load on demand:**
- [references/nextjs-architecture.md](references/nextjs-architecture.md) — when touching `app/` routes,
  layouts, `'use client'` placement, providers, data-access model, Server Actions or route-level errors.
- [references/examples.md](references/examples.md) — before/after trees and code for splitting a
  component, extracting logic, placing constants, promoting to shared, and fixing import violations.

---

## 1. The core principle: colocate, then promote

Put code **as close as possible to the only place that uses it**, and move it up only when a second
consumer actually appears. [15][7][12][25]

Why: colocated code is found without searching, deleted together with its feature, and changed without
fear of breaking a distant consumer. Premature "shared" folders become dumping grounds that nobody owns.

Promotion ladder. Move one rung up only when a consumer outside the current rung needs it:

```
same file  →  sibling file in the component folder  →  parent route/feature folder
           →  cross-feature shared (components/ , lib/)  →  design kit / package
```

- One consumer: stay where you are, even if the code "looks reusable".
- A second consumer in the same feature: move to the nearest common parent folder (like lifting state [4]).
- A consumer in another feature/route: promote to shared. Wait for the rule of three before generalizing
  the API (adding options/props), because duplication is cheaper than the wrong abstraction. [25]
- When the last consumer disappears, move it back down or delete it.

## 2. Where does X go? (decision table)

| Code | Goes in | Rule of thumb |
|---|---|---|
| Route entry | `app/<route>/page.tsx` | Thin: read params/search params, pick a view, compose. No business rules [42] |
| Component used by one route | `app/<route>/_components/<Name>/` | `_` makes it private (not a route) [8] |
| Child used only by one component | `<Name>/_components/<Child>/` | Nest, don't flatten into the route's `_components` |
| Component used across routes/features | `components/<kebab-name>/` | Only after a real second consumer (§1) |
| Generic UI primitive (button, modal, popover) | design kit (`@devdigest/ui` here) | Extend the kit, don't fork it locally |
| Constant used by one component | `<Name>/constants.ts` (or top of the file if tiny and private) | §5 |
| Pure function used by one component | `<Name>/helpers.ts` | §5 |
| Pure function used across features | `lib/<topic>.ts` (named by domain, e.g. `github-urls.ts`) | Never a generic `utils.ts` grab-bag |
| Stateful logic for one component | `use<Thing>.ts` in the component folder (or its `hooks/` subfolder when there are several) | §4 |
| Server-state read/write (API) | query/mutation hooks in the data layer (`lib/hooks/<domain>.ts` here) | §6 |
| HTTP calls | the single API client (`lib/api.ts` here) | Components never call `fetch` [20] |
| Types/contracts shared with the backend | the shared contract package (`@devdigest/shared` here) | Don't redeclare API shapes locally |
| Types local to one component | the component file, or `types.ts` beside it | Promote with the code that uses them |
| Styles | `<Name>/styles.ts` beside the component | Follow the local styling convention |
| Tests | `<Name>/<Name>.test.tsx` / `helpers.test.ts` beside the code | Colocated [15] |
| User-facing strings | `messages/<locale>/*.json` | Never hard-coded in JSX |
| App-wide providers | one client module (`lib/providers.tsx` here) rendered by the root layout | [33][45] |

**In this repo (`client/`):** the layout above is the established one. The PR list route shows it
(`src/app/repos/[repoId]/pulls/`): `page.tsx`, route-level `constants.ts` / `helpers.ts` / `styles.ts`, and
`_components/{FilterBar,PRRow,PrFindingsCell}/` each holding `<Name>.tsx`, `index.ts`, `styles.ts`,
`constants.ts`, `helpers.ts` and a colocated test. Cross-page UI is in `src/components/` (e.g. `run-cost/`,
`diff-viewer/`).

## 3. Splitting components

Split when a component has more than one **reason to change**, not when it hits a line count. [1][25]
Signals that it's time:

- It renders two or more visually distinct regions (header + list + footer) that change independently.
- JSX has nested ternaries or `&&` chains choosing between whole sub-trees. Extract each branch into a
  named component (`<EmptyState/>`, `<ErrorState/>`, `<Loaded/>`).
- A chunk of JSX needs its own state or handlers that the rest doesn't care about. Extract it and move
  the state down with it, so that state colocation [16] also removes needless re-renders.
- The props list keeps growing with flags (`showX`, `variantY`, `isZMode`). Prefer composition
  (`children`, slots) or compound components (`Tabs`, `Tabs.Panel`) over more flags. [27][26]
- Logic dominates the body (data shaping, validation, derived values). Extract it into a hook/helpers
  (§4), and the component often stops needing a split at all.

How to split:
- Name components after **what they are in the domain** (`VerdictBanner`, `FindingCard`), not after their
  layout (`TopBox`, `LeftPanel`).
- One exported component per file, with the folder named the same as the component. Small private
  sub-components used only in that file may stay in it.
- The parent owns data and orchestration, while children receive plain props and callbacks. You don't
  need separate "container" files: a hook gives the same separation. [21][19]

## 4. Business logic: keep it out of JSX

Layers, from inside out. Each layer may depend only on the ones before it. [18][19][20]

1. **Domain rules — pure functions** (`helpers.ts`, or `lib/<domain>.ts` when shared). Calculations,
   mapping, formatting, validation and decisions ("is this finding actionable?"). No React and no I/O,
   so they're trivially unit-testable.
2. **Data access** (§6): the API client plus query/mutation hooks, which own fetching, caching and
   response transformation.
3. **Stateful UI logic — custom hooks** (`use*`). They combine data hooks, local state, effects and
   handlers into what the view needs. They call domain functions and don't re-implement them. [5]
4. **View — components.** They render what the hook returns and wire events to the hook's handlers.

Practical rules:
- If you can write it without React, it's a pure function, not a hook. Only functions that call hooks
  get the `use` prefix. [5]
- Derive values during render from props/state/query data rather than copying them into state with an
  effect. [3][6]
- User actions go in event handlers. Effects are only for synchronizing with something outside React
  (DOM APIs, subscriptions, SSE). [6]
- Rules that the backend also enforces belong to the backend. The frontend may pre-check for UX, but the
  backend is the source of truth. Don't invent a second copy of the rule. [41]

## 5. Constants, helpers, utils, types

**Constants**
- Use a module-level `const` (outside the component) for anything that doesn't depend on props/state:
  lookup maps, option lists, limits, keys. Declaring them inside the component recreates them every render
  and hides them from tests.
- Location follows §1: same file if private and tiny, otherwise `constants.ts` in the component folder,
  then the route/feature folder, then shared. Don't create a global `constants.ts` that collects unrelated
  values.
- Name by meaning (`SEV_COLOR`, `SKELETON_ROWS`, `COLUMN_KEYS`) with `UPPER_SNAKE` for true constants. Type
  lookup maps (`Record<Severity, string>`), and add a documented fallback for unknown keys.
- Not constants: user-facing text (goes in `messages/`), environment config (one config module reading
  `NEXT_PUBLIC_*`) and design tokens (CSS variables/theme).

**Helpers vs utils**
- `helpers.ts` (component/feature scope) and `lib/<topic>.ts` (shared scope) both hold **pure, React-free**
  functions. The difference is only scope. A file that imports React or calls hooks is not a helper.
- Name shared files by **topic** (`github-urls.ts`, `model-label.ts`), never `utils.ts` / `misc.ts`. A
  topic name says what belongs there and what doesn't.
- Every exported helper gets a colocated test once it has a branch (`if`, `switch`, fallback).

**Types**
- API/contract types come from the shared contract package. Derive view types from it (`Pick`, `Omit`,
  `&`) instead of redeclaring the shape.
- Component-local types live with the component, and props types live next to the component they type.

## 6. Data access

- **One HTTP client** (`lib/api.ts`: `apiFetch`, `ApiError` here) owns base URL, headers, error mapping
  and JSON parsing. Nothing else calls `fetch`. [20]
- **Query/mutation hooks per domain** (`lib/hooks/<domain>.ts`) wrap the client. Components import hooks,
  never the client. [22][24]
- **Keys/options are defined once per domain.** Use a key factory or `queryOptions` reused by hooks,
  prefetching and cache updates, never inline string arrays scattered across components. [9][22][23]
- Response shaping (rename, group, sort for display) happens in the data layer (`select` or a mapper
  function), not in the component. [20][24]
- Server state lives in the query cache, while client/UI state stays in components or context. Don't copy
  query data into `useState`/context. [17][24]

**In this repo:** the data path is component → `src/lib/hooks/*` → `apiFetch` → the Fastify API. Run
events stream over SSE inside a hook (`lib/hooks/reviews.ts`), not in components. Add new endpoints as a hook in
the matching domain file.

## 7. Import boundaries

Dependencies point one way: **routes → features/route components → shared → kit/contracts.** [10][11][31]

- Shared code (`components/`, `lib/`) never imports from `app/`. If it needs something from a route, that
  something belongs in shared, or should be passed in as a prop.
- A route doesn't reach into another route's `_components`. If two routes need the same component,
  promote it (§1).
- Import a component folder through its public entry (`./_components/FindingCard`), not its internals
  (`.../FindingCard/helpers`), from outside the folder.
- **Single-entry `index.ts` is fine** (one named re-export per component folder, e.g.
  `export { FindingCard } from "./FindingCard"`). **Don't add aggregate `export *` barrels.** They pull
  whole module graphs into every import, slow dev/test tooling and are the most common source of import
  cycles. [28][29][30]
- Cycles between modules are a design bug. Fix them by moving the shared piece down a level, not with
  lazy imports.
- Use the path alias (`@/lib/...`, `@/components/...`) for anything outside the current route folder. Use
  relative paths only for siblings/children (`./_components/X`, `./constants`). Deep `../../../../` chains
  break on every move and hide which layer you depend on.

**In this repo:** every component folder has a one-line `index.ts`, which is the convention. `lib/hooks/index.ts`
is an existing `export *` barrel. Don't add more like it, and prefer domain-file imports
(`@/lib/hooks/reviews`) in new code. Some older pages still import `../../../../../lib/...`. Use `@/lib/...`
in new code.

## 8. Next.js App Router architecture (summary)

Details and examples are in [references/nextjs-architecture.md](references/nextjs-architecture.md).

- **`app/` is routing.** Pages and layouts are thin composition, and logic lives in `_components/`, hooks and
  `lib/`. [42][46][47]
- **`'use client'` marks a module boundary.** Everything a client module imports becomes client code.
  Place it on the smallest interactive module, and pass server-rendered content through `children`. [33][34][49]
- **Pick one data-access model:** an HTTP API (separate backend) or a server-only Data Access Layer. Don't
  mix ad-hoc fetching into components. [39][40][41]
- **Mutations have one home per resource:** mutation hooks over the API client, or Server Functions in an
  `actions.ts`. Never both. [36][38]
- **Route-level error/not-found/loading UI** goes in segment files. Expected errors are handled as values
  inside the feature. [44]

**In this repo:** `client/` uses the **HTTP API model**. Pages are `'use client'`, all data goes through
React Query hooks to Fastify, and there are no Server Actions. `next-best-practices` recommends Server Actions
for mutations, but **that doesn't apply here**: keep mutations as hooks over `apiFetch`. Only change the
model in a dedicated, discussed refactor.

## 9. Start simple, evolve deliberately

Don't introduce `features/`, FSD layers or a domain layer into a codebase that hasn't needed them. Use the
smallest structure that fits, follow the existing convention of the codebase you're in, and restructure
when the pain is real (files hard to find, cross-feature imports, cycles). [7][12][14]
Consistency with the surrounding code beats any rule in this skill.

## 10. Review checklist

Use this when writing or reviewing frontend changes:

- [ ] Each new file sits at the lowest level that has all its consumers (§1). Nothing was moved to shared
      "for future reuse".
- [ ] `page.tsx` / `layout.tsx` only compose. They contain no business rules or data shaping.
- [ ] No component calls `fetch`/the API client directly. Data goes through a domain hook.
- [ ] Domain rules are pure functions with tests. Hooks orchestrate, and components render.
- [ ] No state that mirrors props or query data. No effect that only derives a value or reacts to a
      click.
- [ ] Constants are module-level, named by meaning, and placed by scope. Strings are in `messages/`.
- [ ] No new `utils.ts`/`misc.ts`, and shared helper files are named by topic.
- [ ] No imports from `app/` into shared code, no reaching into another route's `_components` or a
      folder's internals, and no new `export *` barrels.
- [ ] `'use client'` sits on the smallest module that needs it, and providers stay in the single providers
      module.
- [ ] The change follows the existing convention of the surrounding folder.
