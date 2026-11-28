# Severity rubric

Every finding gets exactly one of `critical | major | minor`. **One verified critical blocks the PR**, so
`critical` is reserved for things that are wrong for sure. When unsure, choose `major`. Map the reviewed
skill's own levels as below; do not invent a stricter scale.

## critical: blocks the PR

Use it only when *all* of these hold:
1. The problem is on a line this diff **added or changed**. Code that was already there is never critical:
   report it as `minor` with `rule: pre-existing` at most.
2. You can quote the exact offending code (`evidence`).
3. It matches one of the rows below.

| Skill | Critical when |
|---|---|
| onion-architecture | Violates a ✅ hard rule (§3 rules 1–7: ORM outside infra, route importing a repository/db/adapter, impure domain, adapter→module, platform→module, cross-module internals, `vendor/shared` importing server code, import cycle), **or** runs queries through `container.db` in a route/service (rule 8) |
| frontend-architecture | Breaks an import boundary from the §10 checklist: shared code imports `app/`, reaching into another route's `_components`, or a component calling `fetch`/the API client directly instead of going through a domain hook |
| react-best-practices | A rule tagged **CRITICAL** in that skill that causes a real bug here: a hook called conditionally, state mutated directly, a missing/incorrect `key` on a dynamic list, a stale closure that produces a wrong value |
| next-best-practices | A server-only module (secrets, `node:*`, db) imported into a `'use client'` tree, or an async API misused so the route breaks at runtime |
| security | Severity **CRITICAL or HIGH** in that skill *and* high confidence after the skill's "verify exploitability" steps: hardcoded secret/token/API key, injection (SQL via `sql.raw`/string concat, shell via `exec` with input, path traversal), XSS via `dangerouslySetInnerHTML` with untrusted data, SSRF, server bound beyond `127.0.0.1` (this API has no auth by design) |
| drizzle-orm-patterns / postgresql-table-design | A migration that drops/renames a column or table with data and has no data migration; a schema change without a generated migration; a multi-statement write that must be atomic but runs outside a transaction |
| zod | Parsing untrusted input with `.parse`/a cast so invalid input crashes or reaches the DB unvalidated at an API boundary |
| typescript-expert | Never critical on its own (typecheck failures arrive as a `checks` critical). `@ts-ignore`/`as any` hiding a real type error → `major` |
| react-testing-library | Never critical |

Deterministic check failures (`arch:check`, `lint`, `typecheck`, `check-shared.sh`) are always critical.
The engine adds them, and they cannot be suppressed.

## major: should fix, doesn't block

The skill's HIGH/MEDIUM rules, 👀 review-only onion rules 9–13 (service locator, raw rows across the
boundary, validation outside the edge, business rules in repositories/routes), misplaced files
(frontend §1), derived state in `useEffect`, missing tests for new logic, `as any`, security MEDIUM.

## minor: nice to have

Naming, small readability issues, LOW security items, things that were already there.

## Not a finding

Style that lint/prettier owns, personal preference, anything outside the diff's changed lines, and
"consider adding…" without a concrete defect.
