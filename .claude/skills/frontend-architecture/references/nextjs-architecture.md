# Next.js App Router — architecture

Read this when touching `app/` routes, layouts, `'use client'` placement, providers, the data-access
model, Server Functions/Actions, or route-level error UI. Performance, caching and the file-convention
reference are out of scope (see `next-best-practices`). Source numbers refer to [../README.md](../README.md).

## Contents
1. What `app/` is for
2. The client boundary
3. Providers
4. Choosing a data-access model
5. Mutations
6. Route-level errors, not-found, loading
7. Route groups and private folders
8. This repo's current shape

---

## 1. What `app/` is for

`app/` maps URLs to code. A folder becomes a public route only once it has `page.tsx` / `route.ts`.
Everything else in it is just colocated files. [8] Keep route files thin:

| File | Owns | Doesn't own |
|---|---|---|
| `layout.tsx` | Shared shell for a segment and state that must survive navigation, plus providers (root only) | Page data, feature logic |
| `page.tsx` | Reading `params` / `searchParams`, choosing a view (loading/error/empty/loaded), composing feature components | Business rules, data shaping, big JSX trees |
| `_components/<Name>/` | The route's UI, hooks, helpers, constants | Anything another route needs (promote it) |

A page that grows past composition should hand its body to a `<RouteName>View` component in
`_components/` (this repo does this already: `SettingsView`, `AgentsListView`, `AddRepoView`). [42][46][47]

## 2. The client boundary

`'use client'` is a **module boundary**, not a per-component flag. The marked module and everything it
imports run on the client. [34] Consequences for structure:

- Mark the **smallest module that needs interactivity** (state, effects, event handlers, browser APIs).
  Keep static wrappers, layouts and data-reading components on the server when the app uses RSC. [33]
- To put server-rendered content inside a client component, pass it as `children` or a prop. Don't import
  a server component into a client module. [33][49]
- Don't let a client module import server-only code (DB access, secrets). Guard server modules with
  `import 'server-only'` so a wrong import fails the build. [39]
- Keep the decision visible: the directive sits at the top of the file, right after the header comment.

```tsx
// app/repos/[repoId]/layout.tsx — server: static shell
export default function RepoLayout({ children }: { children: React.ReactNode }) {
  return <RepoShell sidebar={<RepoNav />}>{children}</RepoShell>; // RepoShell may be 'use client'
}
```

## 3. Providers

All app-wide context providers (query client, theme, toasts, active-entity context) live in **one client
module** rendered by the root layout. Don't put them in individual pages, because each page would get its
own instance. Create the `QueryClient` once per browser session (`useState(() => new QueryClient())`), not
at module scope in a server file. [33][45]

## 4. Choosing a data-access model

Use one model per app and don't mix them. [40]

| Model | Use when | Structure |
|---|---|---|
| **HTTP API** | A separate backend already exists | API client module + query/mutation hooks per domain. Next only renders and maybe proxies [41] |
| **Data Access Layer (DAL)** | Next is the backend (new full-stack app) | `server-only` modules that fetch, authorize and return minimal DTOs. Only the DAL reads `process.env` secrets [39] |
| Component-level access | Prototypes only | Queries inside components. Don't ship this |

With a separate backend, business rules stay in the backend. Route Handlers in Next are for BFF concerns
(aggregation, auth cookie exchange, hiding a third-party key), not for a second copy of domain logic. [41]

When combining React Query with Server Components: prefetch in a Server Component with the same
`queryOptions`/keys the client hooks use, hand the cache over with `HydrationBoundary`, and let the hook
own the data afterwards. There's still one owner of server state. [45]

## 5. Mutations

Pick one home per resource. [36][38]
- **Mutation hooks over the API client** (HTTP API model). They live beside the query hooks of the same
  domain and invalidate that domain's keys.
- **Server Functions** (`'use server'`, DAL model). Put them in a feature `actions.ts`, not inline in
  components. Each one is a public endpoint, so validate input and authorize inside it. [36][40]

Don't implement the same mutation both ways.

## 6. Route-level errors, not-found, loading

- **Expected** failures (validation, 404 from the API, empty results) are values: handle them in the
  feature and render an `ErrorState`/`EmptyState`. [44]
- **Unexpected** failures bubble to the nearest `error.tsx`. Missing resources use `notFound()` →
  `not-found.tsx`. Put these files at the segment whose UI should be replaced. [44]
- Client-rendered pages driven by React Query handle loading/error from the query state inside the page
  or view. `loading.tsx` only helps with server-side rendering/suspense of the segment.

## 7. Route groups and private folders

- `_folder` opts a folder out of routing. Use it for `_components`, `_lib` and `_hooks` colocated with a
  route. [8]
- `(group)` organizes routes (by area, or to share a layout) without affecting the URL. Add one when two
  sibling areas need different layouts, not just to tidy up the tree. [43]

## 8. This repo's current shape (2026-11-27)

- **HTTP API model.** Pages are `'use client'`, data flows component → `src/lib/hooks/<domain>.ts` →
  `apiFetch` (`src/lib/api.ts`) → Fastify on `NEXT_PUBLIC_API_BASE`. No Server Actions or DAL.
- **Providers:** `src/lib/providers.tsx` (React Query, theme, repo context, toasts), rendered by
  `src/app/layout.tsx` inside `NextIntlClientProvider`.
- **i18n:** `messages/<locale>/*.json`, loaded by `src/i18n/request.ts`. Use `useTranslations` in client
  code. [51]
- **No `error.tsx` / `loading.tsx` / `not-found.tsx` yet.** Pages render `Skeleton` / `ErrorState` /
  `RepoNotFound` from query state. Keep that pattern unless a spec introduces segment files.
- **Not applicable here:** `next-best-practices`' advice to prefer Server Actions for mutations and Server
  Components for reads. Adopting it would be an architecture change and needs a spec.
