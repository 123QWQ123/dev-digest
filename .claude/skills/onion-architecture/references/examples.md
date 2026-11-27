# Examples — before/after on real server code

Snippets are trimmed from the repo as of 2026-11-27. §1 and §3 are **applied** — read the real code in
`server/src/modules/pulls/` and `adapters/astgrep`; §2 and §5 show the next steps.

## 1. SQL in a route → route / service / repository (`modules/pulls/routes.ts`)

**Before** — the edge ring talks to Postgres and GitHub directly:

```ts
// routes.ts
import { and, eq } from 'drizzle-orm';               // ❌ onion-orm-only-in-infra
import * as t from '../../db/schema.js';             // ❌ onion-routes-only-call-services

app.get('/pulls/:id', { schema: { params: IdParams } }, async (req): Promise<PrDetail> => {
  const { workspaceId } = await getContext(container, req);
  const [pr] = await container.db.select().from(t.pullRequests)
    .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, req.params.id)));
  if (!pr) throw new NotFoundError('Pull request not found');
  const [repo] = await container.db.select().from(t.repos).where(eq(t.repos.id, pr.repoId));
  …
  const gh = await container.github();
  const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);
  await container.db.delete(t.prFiles).where(eq(t.prFiles.prId, pr.id));
  …
});
```

**After**

```ts
// compose.ts (edge) — the only module file that builds the repository
export function createPullsService(container: Pick<Container, 'db' | 'github'>, log: PullsLogger) {
  return new PullsService({ repo: new PullsRepository(container.db), github: () => container.github(), log });
}

// routes.ts (edge) — imports compose, never the repository (onion-routes-only-call-services)
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const pulls = createPullsService(container, app.log);

  app.get('/pulls/:id', { schema: { params: IdParams } }, async (req): Promise<PrDetail> => {
    const { workspaceId } = await getContext(container, req);
    return pulls.getDetail(workspaceId, req.params.id);
  });
}

// service.ts (app) — no drizzle, no Fastify
export class PullsService {
  constructor(private deps: {
    repo: PullsRepository;
    github: () => Promise<GitHubClient>;   // port from @devdigest/shared
    log: PullsLogger;
  }) {}

  async getDetail(workspaceId: string, prId: string): Promise<PrDetail> {
    const { pr, repo } = await this.requirePrAndRepo(workspaceId, prId);   // 404s
    try {
      const gh = await this.deps.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);
      await this.deps.repo.replaceDetail(pr.id, detail);  // ONE transaction inside the repo
      return { ...detail, id: pr.id };
    } catch (err) {
      this.deps.log.warn({ err }, 'GitHub unavailable; serving persisted detail'); // local-first stays
      return this.deps.repo.loadPersistedDetail(pr);      // mapped to the PrDetail contract
    }
  }
}

// repository.ts (infra) — all Drizzle for pull_requests / pr_files / pr_commits
```

## 2. Service locator → explicit dependencies (`modules/reviews/service.ts`)

**Before**

```ts
export class ReviewService {
  constructor(private container: Container) {
    this.repo = new ReviewRepository(container.db);     // service builds infra itself
    this.agents = container.agentsRepo;
    this.executor = new ReviewRunExecutor(container, this.repo, this.agents);
  }
}
```

**After** (transitional step, no behaviour change)

```ts
type ReviewDeps = Pick<Container, 'agentsRepo' | 'runBus'> & { repo: ReviewRepository };

export class ReviewService {
  constructor(private deps: ReviewDeps, private executor: ReviewRunExecutor) {}
}

// composition (routes plugin or container)
const repo = new ReviewRepository(container.db);
const service = new ReviewService(
  { repo, agentsRepo: container.agentsRepo, runBus: container.runBus },
  new ReviewRunExecutor(container, repo, container.agentsRepo),
);
```

Unit test: `new ReviewService({ repo: fakeRepo, agentsRepo: fakeAgents, runBus: fakeBus }, fakeExecutor)` — no
Postgres, no full container.

## 3. Adapter importing a feature's constant (`adapters/astgrep` → `repo-intel/constants.ts`)

**Before**: `src/adapters/astgrep/index.ts` imports a limit from `modules/repo-intel/constants.ts` —
infra depends on a feature (`onion-adapters-not-to-modules`).

**After**, pick one:
- the value is an adapter default → define it in the adapter, let repo-intel pass an override;
- the value is a cross-cutting contract → move it to `src/vendor/shared` (mirror to `client/` if exported
  from the shared index) and import it from both sides;
- the value belongs to the repo-intel domain → put it in `modules/repo-intel/types.ts`/`ports.ts`
  (allowed for adapters) and keep `constants.ts` internal.

Then `pnpm arch:baseline` → the entry disappears from the baseline.

## 4. Business rule as a pure domain function (good precedent: `modules/pulls/status.ts`)

```ts
// status.ts — no imports beyond @devdigest/shared types
export function totalPrCost(rows: RunCostRow[]): Map<string, number | null> { … } // per-PR sum, NULL = unknown
```

The route/service loads rows, the domain function decides (NULL = unknown vs 0 = free), and it is unit-tested
without a DB. New rules of this kind go to `domain.ts` (purity-checked) or a similarly pure file.

## 5. Transaction with a unit of work

```ts
// ports.ts (domain)
export interface ReviewUnitOfWork {
  run<T>(work: (r: { reviews: ReviewRepository; runs: RunRepository }) => Promise<T>): Promise<T>;
}

// repository.ts (infra)
export const drizzleReviewUow = (db: Db): ReviewUnitOfWork => ({
  run: (work) => db.transaction((tx) => work({ reviews: new ReviewRepository(tx), runs: new RunRepository(tx) })),
});

// service.ts (app)
const result = await this.llm.completeStructured(req);   // external I/O OUTSIDE the tx
await this.uow.run(async ({ reviews, runs }) => {
  const review = await reviews.insert(result);
  await runs.markDone(runId, review.id);
});
```
