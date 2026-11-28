# Drizzle as infrastructure

Drizzle, Postgres and the generated schema types are the infra ring. They are imported only by
repositories, `src/db/**`, adapters and the composition root (`onion-orm-only-in-infra`). For query,
relation and migration syntax use `drizzle-orm-patterns`; for table design use `postgresql-table-design`.

## 1. Repositories

- One repository per module, owning the module's tables. Split into `repository/<aggregate>.repo.ts`
  modules of plain functions `(db, …args)` composed by a `XRepository` class when it grows
  (as `reviews/repository.ts` does).
- Constructor takes the `Db` handle (`src/db/client.ts`) — never a `Container`.
- **Every query on a workspace-owned table filters by `workspaceId`.** Scoping is a repository
  responsibility; the service passes the id.
- Methods are named in domain language (`getPull`, `listEnabled`, `saveRunTrace`), not table language
  (`selectFromPullRequestsWhere…`). [19][20]
- Repositories don't decide business outcomes. Return data; the service/domain decides.

## 2. Types: keep `$inferSelect` in the infra ring

Drizzle infers row types: `typeof table.$inferSelect` / `InferSelectModel<typeof table>`. [18]

- Rows are fine **inside** the repository and as internal types between repository and service of the
  same module when the shapes are identical.
- Rows must **not** become the HTTP/API contract. Map to the `@devdigest/shared` contract (snake_case,
  ISO dates, nullable semantics) in `helpers.ts`/the repository. A DB column rename should break a
  mapper, not the client.
- Cross-module row types go through `src/db/rows.ts` (type-only), never by importing another module's
  repository.

```ts
// repository.ts (infra)
export class PullsRepository {
  constructor(private db: Db) {}
  async findDetail(workspaceId: string, prId: string): Promise<PullDetail | null> {
    const [row] = await this.db.select().from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    return row ? toPullDetail(row) : null; // mapping stays here
  }
}
```

## 3. Ports for repositories — when

- Default: the service receives the **concrete repository class** through its constructor. Unit tests
  pass an object literal typed as `Pick<XRepository, 'method'>`. That's a seam without ceremony.
- Extract `interface XStore` into `ports.ts` when: a second implementation exists (in-memory, remote),
  another module consumes it, or the domain must not see the class.

## 4. Transactions — unit of work

Drizzle runs a transaction as a callback: `await db.transaction(async (tx) => { … })`; every statement
inside must use `tx`, not `db`. The callback's return value is the transaction's result. Nested
`tx.transaction(…)` creates a savepoint; `tx.rollback()` throws to abort. [17]

The **service decides the boundary** (which steps are atomic); the **repository owns the Drizzle call**.

```ts
// repository.ts (infra)
export class ReviewRepository {
  constructor(private db: Db | Tx) {}
  /** Runs `work` in one DB transaction with a tx-bound repository. */
  withTransaction<T>(work: (repo: ReviewRepository) => Promise<T>): Promise<T> {
    return (this.db as Db).transaction((tx) => work(new ReviewRepository(tx)));
  }
}
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

// service.ts (app) — no drizzle import
await this.repo.withTransaction(async (repo) => {
  const review = await repo.insertReview(…);
  await repo.insertFindings(review.id, kept);
});
```

- Multiple repositories in one tx → a small `UnitOfWork` port in `ports.ts`
  (`run<T>(work: (repos: { reviews; runs }) => Promise<T>): Promise<T>`) implemented in infra.
- Never pass `tx` through routes; never call `container.db.transaction` from a service.
- Keep external I/O (LLM, GitHub) **outside** the transaction callback — long transactions hold locks.

> **In this repo:** there are no `db.transaction` calls yet (2026-11-27). The first one should follow this
> pattern so it becomes the precedent.

## 5. Testing by ring

| Ring | Test | DB? |
|---|---|---|
| domain | plain vitest unit tests | no |
| service | unit tests with fake repos/ports (`adapters/mocks.ts`, object literals) | no |
| repository | `*.it.test.ts` with testcontainers (`test/helpers/pg.ts`) | yes |
| routes | `app.inject` smoke / integration | optional |

If a service can only be tested with Postgres, it is doing infra work — move that into the repository.
