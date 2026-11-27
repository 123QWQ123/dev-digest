# client — @devdigest/web (Next.js 15 App Router, pnpm)

## Commands
dev `pnpm dev` (:3000) · `pnpm test` (vitest + jsdom, fetch mocked, no API needed) · `pnpm typecheck` · `pnpm lint`
(ESLint: next/core-web-vitals + next/typescript, incl. react-hooks) · `pnpm arch:check` (import
boundaries, dependency-cruiser: shared ↛ app, lib ↛ components, no cross-route `_components`, UI ↛ `lib/api.ts`) · `pnpm build`

## Where things are
- `src/app/**/page.tsx` — routes; feature components colocated in `_components/<Name>/`
- `src/lib/api.ts` — the only HTTP client (`apiFetch`, `ApiError`); `src/lib/hooks/*` — React Query hooks
- `src/components/` — cross-page components (app-shell, diff-viewer, …)
- `src/vendor/ui` (`@devdigest/ui`) — vendored design kit; `src/vendor/shared` — Zod contracts (copy)
- `messages/<locale>/*.json` — next-intl strings

## Gotchas
- All data access goes hook → `apiFetch`. No raw `fetch` in components.
- `src/vendor/shared` is a COPY of server/src/vendor/shared (canonical). Edit the server copy, then
  `../scripts/check-shared.sh --fix`; CI fails on drift.
- Prefer existing primitives from `@devdigest/ui` over new ad-hoc components.
- User-facing text goes into messages/, not hardcoded.
- API base comes from `NEXT_PUBLIC_API_BASE` (default http://localhost:3001).
- Run traces stream over SSE (`/runs/:id/events`), not polling.

## Do not touch without discussion
- `src/vendor/ui` internals — shared design kit; extend, don't fork

## Use when
- Route map, which API each page calls → read `README.md`
- Building UI, picking components → read `src/vendor/ui/README.md`
- Writing tests → read `../TESTING.md`
- Implementing a feature → read `specs/`
- Design decisions, ADRs → read `docs/`
- Before starting ANY work here → read `INSIGHTS.md` (mandatory)
