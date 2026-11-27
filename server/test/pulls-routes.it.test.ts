/**
 * Pulls module — GET /repos/:id/pulls (list + rollups) and GET /pulls/:id
 * (detail, local-first). Characterizes the HTTP contract so the module can be
 * refactored into route → service → repository without behaviour change, and
 * pins the atomic replace of a PR's files/commits on detail refresh.
 * Gated on Docker (testcontainers Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { PrDetail, PrMeta, RepoRef } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/** GitHub that is configured but unreachable — every call rejects. */
class OfflineGitHubClient extends MockGitHubClient {
  override async listPullRequests(_repo: RepoRef): Promise<PrMeta[]> {
    throw new Error('offline');
  }
  override async getPullRequest(_repo: RepoRef, _n: number): Promise<PrDetail> {
    throw new Error('offline');
  }
}

let repoSeq = 0;
async function setupRepoAndPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `pulls-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 7,
      title: 'Add rate limiting',
      author: 'marisa.koch',
      branch: 'feat/rl',
      base: 'main',
      headSha: 'deadbeef',
      additions: 3,
      deletions: 1,
      filesCount: 1,
      status: 'open',
      body: 'persisted body',
    })
    .returning();
  await db.insert(t.prFiles).values({ prId: pr!.id, path: 'old.ts', additions: 3, deletions: 1, patch: '@@' });
  await db.insert(t.prCommits).values({ prId: pr!.id, sha: 'old1', message: 'old commit', author: 'm' });
  return { repo: repo!, pr: pr! };
}

d('pulls routes (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('GET /pulls/:id refreshes from GitHub and persists files + commits', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { github: new MockGitHubClient() } });
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as PrDetail & { id: string };
    expect(body.id).toBe(pr.id);
    expect(body.body).toBe('Add rate limiting. Closes #471.');
    expect(body.files.map((f) => f.path)).toEqual(['src/config.ts']);

    const files = await pg.handle.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
    const commits = await pg.handle.db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id));
    expect(files.map((f) => f.path)).toEqual(['src/config.ts']);
    expect(commits.map((c) => c.sha)).toEqual(['a1b2c3d4']);
    const [row] = await pg.handle.db.select().from(t.pullRequests).where(eq(t.pullRequests.id, pr.id));
    expect(row!.body).toBe('Add rate limiting. Closes #471.');
    expect(row!.additions).toBe(247);
    await app.close();
  });

  it('GET /pulls/:id serves the persisted detail when GitHub is offline', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { github: new OfflineGitHubClient() } });
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json() as PrDetail & { id: string };
    expect(body).toMatchObject({
      id: pr.id,
      number: 7,
      title: 'Add rate limiting',
      head_sha: 'deadbeef',
      status: 'open',
      body: 'persisted body',
      additions: 3,
      deletions: 1,
      files_count: 1,
    });
    expect(body.files).toEqual([{ path: 'old.ts', additions: 3, deletions: 1, patch: '@@' }]);
    expect(body.commits).toEqual([{ sha: 'old1', message: 'old commit', author: 'm', committed_at: null }]);
    await app.close();
  });

  it('GET /pulls/:id keeps the old files/commits when persisting the refresh fails midway', async () => {
    // A commit without a sha violates NOT NULL → the insert of commits fails
    // AFTER files were replaced. The replace must be atomic: nothing changes.
    const gh = new MockGitHubClient({
      detail: { commits: [{ sha: null as unknown as string, message: 'x', author: 'y', committed_at: null }] },
    });
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { github: gh } });
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
    expect(res.statusCode).toBe(200); // falls back to the persisted detail
    const files = await pg.handle.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
    const commits = await pg.handle.db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id));
    expect(files.map((f) => f.path)).toEqual(['old.ts']);
    expect(commits.map((c) => c.sha)).toEqual(['old1']);
    expect((res.json() as PrDetail).files.map((f) => f.path)).toEqual(['old.ts']);
    await app.close();
  });

  it('GET /pulls/:id is 404 for an unknown PR', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { github: new MockGitHubClient() } });
    const res = await app.inject({ method: 'GET', url: '/pulls/00000000-0000-0000-0000-000000000000' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('GET /repos/:id/pulls rolls up score, latest round and total cost (offline)', async () => {
    const db = pg.handle.db;
    const app = await buildApp({ config: config(), db, overrides: { github: new OfflineGitHubClient() } });
    const { repo, pr } = await setupRepoAndPr(db, workspaceId);
    const [agentA] = await db.select().from(t.agents).limit(1);

    const [older] = await db
      .insert(t.reviews)
      .values({ workspaceId, prId: pr.id, agentId: agentA!.id, kind: 'review', score: 40, createdAt: new Date('2026-01-01') })
      .returning();
    const [newer] = await db
      .insert(t.reviews)
      .values({ workspaceId, prId: pr.id, agentId: agentA!.id, kind: 'review', score: 80, createdAt: new Date('2026-01-02') })
      .returning();
    const finding = { file: 'a.ts', startLine: 1, endLine: 1, category: 'bug', title: 't', rationale: 'r', confidence: 0.9 };
    await db.insert(t.findings).values([
      { ...finding, reviewId: older!.id, severity: 'CRITICAL' },
      { ...finding, reviewId: newer!.id, severity: 'WARNING' },
      { ...finding, reviewId: newer!.id, severity: 'SUGGESTION' },
    ]);
    await db.insert(t.agentRuns).values([
      { workspaceId, prId: pr.id, costUsd: 0.01 },
      { workspaceId, prId: pr.id, costUsd: 0.02 },
      { workspaceId, prId: pr.id, costUsd: null },
    ]);

    const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
    expect(res.statusCode).toBe(200);
    const list = res.json() as PrMeta[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: pr.id,
      number: 7,
      head_sha: 'deadbeef',
      status: 'needs_review',
      score: 80,
      latest_round: { review_ids: [newer!.id], critical: 0, warning: 1, suggestion: 1 },
    });
    expect(list[0]!.cost_usd).toBeCloseTo(0.03);
    await app.close();
  });

  it('GET /repos/:id/pulls is 404 for an unknown repo', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { github: new MockGitHubClient() } });
    const res = await app.inject({ method: 'GET', url: '/repos/00000000-0000-0000-0000-000000000000/pulls' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
