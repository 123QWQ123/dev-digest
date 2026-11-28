# frontend-architecture

**Version:** 1.0.0 · **Updated:** 2026-11-27 · **Scope:** React + Next.js App Router, code organization

An agent skill that answers **"where does this code go, and what may it depend on?"** for frontend code:
component placement and splitting, where constants, helpers/utils, types, hooks and business logic live,
the data-access layer, import boundaries and barrel files, and Next.js App Router architecture (server/client
boundary, providers, data-access model, mutations, route-level errors).

Rules are generic, and each section has an **"In this repo"** note that maps it onto DevDigest's `client/`.

## Files

| File | Loaded | Contents |
|---|---|---|
| [SKILL.md](SKILL.md) | When the skill triggers | Principles, "where does X go" table, splitting, logic layers, constants/helpers/types, data access, import rules, Next.js summary, review checklist |
| [references/nextjs-architecture.md](references/nextjs-architecture.md) | On demand | App Router details: `app/` responsibilities, client boundary, providers, data-access models, mutations, errors, route groups, this repo's current shape |
| [references/examples.md](references/examples.md) | On demand | Before/after trees and code for each rule |
| README.md | Humans / source lookup | This file: versioning, scope, sources |

## Scope and neighbours

| Topic | Skill |
|---|---|
| Code organization and architecture (this skill) | `frontend-architecture` |
| Hooks misuse, state anti-patterns, render performance | `react-best-practices` |
| Next.js file-convention reference, RSC serialization, images, fonts, bundling, caching | `next-best-practices` |
| Component tests | `react-testing-library` |

Where this skill and `next-best-practices` disagree for this repo (Server Actions vs mutation hooks), this
skill wins, because `client/` uses the HTTP API model. See SKILL.md §8.

## Versioning

[SemVer](https://semver.org/). The version lives in `SKILL.md` frontmatter (`metadata.version`) and in this
README. Bump both together.
- **MAJOR**: a rule is reversed or removed (code that followed the old rule now violates it).
- **MINOR**: a new rule, section or reference file.
- **PATCH**: wording, examples, source fixes, repo-note updates.

### Changelog

- **1.0.0** (2026-11-27): first version. Colocation/promotion ladder, placement table, component splitting,
  logic layers, constants/helpers/types, data access, import boundaries (single-entry `index.ts` OK, no
  `export *` barrels, `@/` alias), Next.js App Router architecture, review checklist. 51 sources.

## Sources

Collected 2026-11-27. Every URL was checked (HTTP 200) on that date unless it is marked otherwise. Rules in
SKILL.md cite sources by number, e.g. `[15]`.

**Source policy.** Groups A–E and G are normative: official docs and named practitioners. Group F is used only
to compare format and coverage. Generic aggregator posts ("React folder structure 2025" listicles on
dev.to/Medium) are excluded on purpose, because they repeat these sources without adding evidence. When
adding a rule, cite at least one normative source. When adding a source, give it the next free number and
never renumber.

## A. Official docs (highest authority)

| # | Source | What we take from it |
|---|---|---|
| 1 | [React — Thinking in React](https://react.dev/learn/thinking-in-react) | Splitting a UI into a component hierarchy (single-responsibility), finding the minimal state and where it lives |
| 2 | [React — Keeping Components Pure](https://react.dev/learn/keeping-components-pure) | Render must stay pure, and side effects go in handlers/effects. This is why logic can be moved out into pure functions |
| 3 | [React — Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) | Avoid redundant/derived state: derive during render instead of storing |
| 4 | [React — Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) | Lift state to the closest common parent, no higher |
| 5 | [React — Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) | Custom hooks as the unit for extracting stateful logic. Naming: only functions that call hooks are `use*` |
| 6 | [React — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) | Derived data is computed in render and user actions go in event handlers. Effects are only for syncing with external systems |
| 7 | [React (legacy) — File Structure FAQ](https://legacy.reactjs.org/docs/faq-structure.html) | Group by feature/route or by file type, avoid deep nesting, and "don't overthink it" (start simple) |
| 8 | [Next.js — Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) | Folders become public routes only with `page`/`route`. Covers private `_folders`, route groups `(group)`, the `src/` dir, and three valid strategies (outside `app`, top-level in `app`, split by feature/route). Colocation section: `#colocation` |
| 9 | [TanStack Query — `queryOptions`](https://tanstack.com/query/latest/docs/framework/react/reference/functions/queryOptions) | One typed definition of key + fn, reused by hooks, prefetching and cache updates |

## B. Reference architectures (where things live)

| # | Source | What we take from it |
|---|---|---|
| 10 | [Bulletproof React — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) | `src/app` (routes, providers), `src/features/<f>/{api,components,hooks,stores,types,utils}`, plus shared `components/hooks/lib/utils/config`. Unidirectional imports shared → features → app, no cross-feature imports, and ESLint enforcement |
| 11 | [Feature-Sliced Design — Overview](https://feature-sliced.design/docs/get-started/overview) | Layers app/pages/widgets/features/entities/shared, slices and segments (`ui`, `model`, `api`, `lib`, `config`), and a public API per slice. A module imports only from layers strictly below it |
| 12 | [Robin Wieruch — React Folder Structure in 5 Steps](https://www.robinwieruch.de/react-folder-structure/) | Incremental growth: single file → files → folders per component → technical folders → feature folders. Don't start at the largest structure |
| 13 | [Josh W. Comeau — Delightful React File/Directory Structure](https://www.joshwcomeau.com/react/file-structure/) | The counter-view: organize by function (`components/`, `hooks/`, `helpers/`, `constants.js`) and keep a folder per component with its own helpers/constants file. Useful for "per-component file set" conventions |
| 14 | [Profy.dev — Screaming Architecture: Evolution of a React folder structure](https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25) | Why type-based folders stop scaling and how the structure should "scream" the domain. Shows a step-by-step migration to features |
| 15 | [Kent C. Dodds — Colocation](https://kentcdodds.com/blog/colocation) | "Place code as close to where it's relevant as possible." Covers tests, styles, utils and constants beside their consumer |
| 16 | [Kent C. Dodds — State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) | Push state down to the component that uses it, and keep global stores for truly global state |
| 17 | [Kent C. Dodds — Application State Management with React](https://kentcdodds.com/blog/application-state-management-with-react) | Server cache vs UI state. Composition and context before global stores |

## C. Business logic, layers, data access

| # | Source | What we take from it |
|---|---|---|
| 18 | [Martin Fowler / Juntao Qiu — Modularizing React Applications with Established UI Patterns](https://martinfowler.com/articles/modularizing-react-apps.html) | Layered evolution: view → hooks → domain models → gateways (data access). Moving business rules out of JSX into plain classes/functions, and strategy/polymorphism for variants |
| 19 | [Martin Fowler / Juntao Qiu — Headless Component](https://martinfowler.com/articles/headless-component.html) | A hook owns state and behavior, while the component owns markup only, so you can swap the UI without touching logic |
| 20 | [Johannes Kettmann — Path to a Clean(er) React Architecture (series)](https://dev.to/jkettmann/series/27067) | Shared API client → fetch functions → data transformations in the API layer → domain entities/DTOs → business-logic separation → domain logic. A concrete refactoring sequence |
| 21 | [Dan Abramov — Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0) | The original container/presentational split and his 2019 update that hooks replace the need for it. Use it as a mindset, not a mandatory folder rule. *(Medium returns 403 to automated checks. Opens in a browser.)* |
| 22 | [TkDodo — Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys) | Colocate query keys with the feature, use one key factory per feature, and wrap queries in custom hooks |
| 23 | [TkDodo — The Query Options API](https://tkdodo.eu/blog/the-query-options-api) | `queryOptions` factories as the shareable unit instead of (or under) custom hooks |
| 24 | [TkDodo — Practical React Query (series index)](https://tkdodo.eu/blog/practical-react-query) | Server state is not client state, data transformation via `select`, and custom-hook boundaries |

## D. Component design & patterns

| # | Source | What we take from it |
|---|---|---|
| 25 | [Alex Kondov — Tao of React](https://alexkondov.com/tao-of-react/) | Decide early where shared components, hooks, business logic, constants and utils live. Rule of three before abstracting, keep components small, and keep logic out of JSX |
| 26 | [patterns.dev — React patterns](https://www.patterns.dev/react/) | Compound, hooks, container/presentational, render-props and provider patterns with trade-offs. *(Did not respond from the dev machine on 2026-11-27. Verify in a browser before citing.)* |
| 27 | [Kent C. Dodds — Compound Components with React Hooks](https://kentcdodds.com/blog/compound-components-with-react-hooks) | Context-based compound components (e.g. `Tabs`/`Tabs.List`/`Tabs.Panel`) as an alternative to prop explosion |

## E. Imports, barrels, enforcement

| # | Source | What we take from it |
|---|---|---|
| 28 | [Marvin Hagemeister — Speeding up the JS ecosystem: The barrel file debacle](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/) | `index.ts` re-exports in every folder slow tooling/tests and load whole module graphs. Prefer direct imports inside app code |
| 29 | [Atlassian — Faster builds when removing barrel files](https://www.atlassian.com/blog/how-we-build/faster-builds-when-removing-barrel-files) | Real-world numbers for removing barrels (build/test speed) |
| 30 | [Vercel — How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js) | Why barrels hurt Next.js dev/bundle, and `optimizePackageImports` for third-party barrels |
| 31 | [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) | Enforce layer/feature import rules (no deep imports into another feature, shared can't import features) |

## F. Existing agent skills (format/coverage comparison only)

| # | Source | What we take from it |
|---|---|---|
| 32 | [Vercel Labs — agent-skills `react-best-practices`](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Rule-file format (why → incorrect → correct, impact-tagged). Its content is perf-focused and doesn't overlap with this skill |

## G. Next.js App Router architecture (no performance topics)

| # | Source | What we take from it |
|---|---|---|
| 33 | [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | Server by default and `'use client'` only on interactive leaves. Pass Server Components into Client ones via `children`/props, put context providers in one client module rendered by the layout, and keep server-only code out of client modules |
| 34 | [React — `'use client'`](https://react.dev/reference/rsc/use-client) | The directive marks a **module boundary**: everything a client module imports becomes client code. That's why the directive's position decides the architecture |
| 35 | [React — Server Components](https://react.dev/reference/rsc/server-components) | What runs where, and async components reading data directly. Mental model for the server/client split |
| 36 | [React — Server Functions](https://react.dev/reference/rsc/server-functions) | `'use server'` functions are network endpoints callable from the client, so treat them as a public API |
| 37 | [Next.js — Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) | Fetch in Server Components close to where data is used, share via `React.cache`, and use the client-side option (`use` + promise, or a library like TanStack Query) |
| 38 | [Next.js — Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) | Server Functions in a dedicated `actions.ts` module vs inline, invoked from forms/event handlers, then revalidate/redirect after mutation |
| 39 | [Next.js — Data Security guide](https://nextjs.org/docs/app/guides/data-security) | **Data Access Layer** (DAL): one internal server module owns data fetching and auth checks and returns minimal DTOs. Guard it with `import 'server-only'`, and only the DAL reads `process.env` |
| 40 | [Next.js blog — How to Think About Security in Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) | Three data-handling models: HTTP APIs (existing backend), DAL (new projects) and component-level access (prototypes only). Don't mix models |
| 41 | [Next.js — Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend) | When Next sits in front of a separate backend: what belongs in Route Handlers/proxying vs the real API. Don't duplicate backend business logic in Next |
| 42 | [Next.js — Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) | Responsibility split: layout = shared shell and persistent state, page = route entry. Pages read params/searchParams and compose feature components |
| 43 | [Next.js — Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) | `(group)` folders organize routes by area/team or give a subset its own layout without changing URLs |
| 44 | [Next.js — Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) | Expected errors are return values (not thrown). Uncaught errors go to segment-level `error.tsx`/`not-found.tsx`, which decides where error UI lives in the tree |
| 45 | [TanStack Query — Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) | React Query with the App Router: one `QueryClient` provider (client module), prefetch in Server Components + `HydrationBoundary`, and which layer owns server state |
| 46 | [Bulletproof React — Next.js App Router variant](https://github.com/alan2207/bulletproof-react/tree/master/apps/nextjs-app) | Reference repo: thin `src/app` routes over `src/features/*`, plus shared `components/lib/hooks` |
| 47 | [Feature-Sliced Design — Usage with Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs) | Keep the Next `app/` folder as routing only and re-export page compositions from the FSD layer. How to resolve the `app`/`pages` name clash |
| 48 | [Dan Abramov — The Two Reacts](https://overreacted.io/the-two-reacts/) | Why UI = f(data) on the server and UI = f(state) on the client are both needed. Conceptual basis for deciding which side a component belongs to |
| 49 | [Dan Abramov — Impossible Components](https://overreacted.io/impossible-components/) | Composing server-data components with client-interactive ones, and passing data down across the boundary instead of fetching again |
| 50 | [Josh W. Comeau — Making Sense of React Server Components](https://www.joshwcomeau.com/react/server-components/) | Approachable explanation of the boundary, the "client boundary" tree and common misconceptions (client components still SSR) |
| 51 | [next-intl — App Router setup](https://next-intl.dev/docs/getting-started/app-router) | Where `messages/`, `i18n/request.ts` and the provider live. Server (`getTranslations`) vs client (`useTranslations`) usage |

The `server-only` package ([npm](https://www.npmjs.com/package/server-only)) is referenced from [39]. npm returns
403 to automated checks, but the page opens in a browser.

**Fit to this repo (2026-11-27).** `client/` is client-heavy: route `page.tsx` files are `'use client'` (62
client modules), all data goes hook → `apiFetch` → the separate Fastify API, and there are no Server Actions.
In [40]'s terms the repo uses the **HTTP API model**. So [39] DAL and [38] Server Functions are context for
"if we ever move data access to the server", not current rules. The rules that apply now are [33][34] (boundary
placement, providers in `src/lib/providers`), [42][43][44] (route responsibilities) and [45] (React Query ownership).
