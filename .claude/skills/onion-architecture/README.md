# onion-architecture

**Version:** 1.1.0 · **Updated:** 2026-11-27 · **Scope:** Node/TypeScript backend (`server/`: Fastify 5 + Drizzle ORM + Zod)

An agent skill that enforces **Onion Architecture** in the backend. It answers "which ring does this code
belong to, and what may it import?", and how to split routes, services (use cases), domain rules, ports,
repositories and adapters. It also explains the transaction boundary, DI wiring, and the dependency-cruiser
rules that check all of this in CI (`pnpm arch:check`).

Rules are generic. Each section carries an **"In this repo"** note mapping it onto DevDigest's `server/`.

## Files

| File | Loaded | Contents |
|---|---|---|
| [SKILL.md](SKILL.md) | When the skill triggers | Dependency rule, rings in repo terms, hard rules (✅ tool / 👀 review), "where does X go", pragmatism, checklists, baseline, anti-patterns |
| [references/layers-and-placement.md](references/layers-and-placement.md) | On demand | Module anatomy, full placement table, import matrix, cross-module access, naming |
| [references/fastify.md](references/fastify.md) | On demand | Fastify as the edge ring: thin routes, plugins/encapsulation, composition root, DI, errors |
| [references/drizzle.md](references/drizzle.md) | On demand | Drizzle as infra: repositories, mapping, `$inferSelect` leakage, transactions/unit of work, tests |
| [references/enforcement.md](references/enforcement.md) | On demand | `.dependency-cruiser.cjs` rule by rule, baseline workflow, fixing failures, blind spots |
| [references/examples.md](references/examples.md) | On demand | Before/after refactors on real `server/` code |
| README.md | Humans / source lookup | This file: versioning, scope, sources |

Files outside the skill that implement the enforcement:
- `server/.dependency-cruiser.cjs` — the layer rules
- `server/.dependency-cruiser-known-violations.json` — baseline of pre-existing violations
- `server/package.json` — `arch:check`, `arch:baseline`
- `.github/workflows/server-unit.yml` — runs `pnpm arch:check` in the `typecheck` job

## Scope and neighbours

| Topic | Skill |
|---|---|
| Rings, dependency direction, placement, enforcement (this skill) | `onion-architecture` |
| Fastify routes, hooks, plugins API, schemas, perf | `fastify-best-practices` |
| Drizzle query/relation/migration syntax | `drizzle-orm-patterns` |
| Table design, indexes, constraints | `postgresql-table-design` |
| Zod schema authoring | `zod` |
| The same question for `client/` | `frontend-architecture` |

## Versioning

[SemVer](https://semver.org/). The version lives in `SKILL.md` frontmatter (`metadata.version`) and in this
README. Bump both together.
- **MAJOR**: a rule is reversed or removed (code that followed the old rule now violates it).
- **MINOR**: a new rule (incl. a new dependency-cruiser rule), section or reference file.
- **PATCH**: wording, examples, source fixes, repo-note updates.

Changing a dependency-cruiser rule = update `server/.dependency-cruiser.cjs`, SKILL.md §3 and
`references/enforcement.md` in the same commit.

## Sources

All links were opened and checked on 2026-11-27. `[n]` in the skill files refers to this list.

**Onion Architecture and its relatives**
1. Jeffrey Palermo — *The Onion Architecture: part 1* (2008). The original: the dependency rule, "the database is not the center". https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
2. Jeffrey Palermo — *The Onion Architecture: part 2* (2008). Worked example. https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
3. Jeffrey Palermo — series index incl. *Part 3* and *Part 4 – After Four Years* (2013). The four tenets; "any outer layer can directly call any inner layer"; works without an IoC container. https://jeffreypalermo.com/tag/onion-architecture
4. Herberto Graça — *Onion Architecture* (Software Architecture Chronicles, 2017). https://herbertograca.com/2017/09/21/onion-architecture/
5. Allegro Tech Blog — *Onion Architecture* (2023). https://blog.allegro.tech/2023/02/onion-architecture.html
6. NDepend — *Onion Architecture: Going Beyond Layers*. https://blog.ndepend.com/onion-architecture-layers/
7. Milan Jovanović — *Clean Architecture vs Onion Architecture vs Hexagonal Architecture*. Includes enforcing the rule with folders and architecture tests. https://milanjovanovic.tech/blog/clean-architecture-vs-onion-vs-hexagonal
8. Mark Seemann — *Composition Root* (2011). https://blog.ploeh.dk/2011/07/28/CompositionRoot/
9. Eric Damtoft — *Onion vs Clean vs Hexagonal Architecture*. https://medium.com/@edamtoft/onion-vs-clean-vs-hexagonal-architecture-9ad94a27da91
10. Alistair Cockburn — *Hexagonal Architecture (Ports and Adapters)* (2005). https://alistair.cockburn.us/hexagonal-architecture/
11. Robert C. Martin — *The Clean Architecture* (2012). https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html

**Fastify**
12. Fastify docs — *Encapsulation*. https://fastify.dev/docs/latest/Reference/Encapsulation/
13. Fastify docs — *The hitchhiker's guide to plugins*. https://fastify.dev/docs/latest/Guides/Plugins-Guide/
14. Matteo Collina — *Building a modular monolith with Fastify* (Node Congress 2023). https://gitnation.com/contents/building-a-modular-monolith-with-fastify
15. marcoturi/fastify-boilerplate — Fastify 5, hexagonal/onion-influenced, dependency-cruiser layer rules in CI. https://github.com/marcoturi/fastify-boilerplate
16. `@fastify/awilix` — DI container plugin. For reference only; this repo uses a hand-written container. https://www.npmjs.com/package/@fastify/awilix

**Drizzle / repositories**
17. Drizzle docs — *Transactions* (`db.transaction(async (tx) => …)`, nested savepoints, `tx.rollback()`). https://orm.drizzle.team/docs/transactions
18. Drizzle docs — *Goodies* (`$inferSelect` / `InferSelectModel`). https://orm.drizzle.team/docs/goodies
19. folionaut — *ADR-004: Repository Pattern* (Drizzle behind a repository; tx support as a requirement). https://spencerjireh.github.io/folionaut/decisions/004-repository-pattern
20. LogRocket — *Exploring the repository pattern with TypeScript and Node*. https://blog.logrocket.com/exploring-repository-pattern-typescript-node

**Enforcement**
21. dependency-cruiser — *Rules reference* (`forbidden`, `path`/`pathNot`, `$1` group matching, `circular`, `viaOnly`). https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
22. dependency-cruiser — *CLI* (`--ignore-known`, known-violations baseline). https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md
23. Atomic Object — *Dependency Cruiser: Restrict Imports in JavaScript*. https://spin.atomicobject.com/dependency-cruiser-imports/
24. Remo Jansen — *Enforce Clean Architecture in your TypeScript projects with fresh-onion*. https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi
25. ArchUnitTS — architecture tests as unit tests (an alternative to dependency-cruiser). https://github.com/LukasNiessen/ArchUnitTS
