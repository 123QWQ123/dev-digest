/**
 * Settings prefs + workspace overview routes — HTTP contract after the
 * route → service → repository split. Gated on Docker (testcontainers Postgres).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('settings + workspace routes (Testcontainers pg)', () => {
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

  it('PUT /settings upserts several keys and GET /settings reads them back', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db });
    const put = await app.inject({
      method: 'PUT',
      url: '/settings',
      payload: { theme: 'dark', density: 'compact' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({ theme: 'dark', density: 'compact' });

    // Update one key, keep the other.
    await app.inject({ method: 'PUT', url: '/settings', payload: { theme: 'light' } });
    const get = await app.inject({ method: 'GET', url: '/settings' });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({ theme: 'light', density: 'compact' });
    await app.close();
  });

  it('GET /workspace lists the workspace repos with clone state', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db });
    await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'ws-cloned', fullName: 'acme/ws-cloned', clonePath: '/tmp/x' });
    const res = await app.inject({ method: 'GET', url: '/workspace' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      workspaceId: string;
      cloneDir: string;
      repos: { full_name: string; clone_path: string | null; cloned: boolean; last_polled_at: string | null }[];
    };
    expect(body.workspaceId).toBe(workspaceId);
    expect(body.cloneDir).toBe(app.container.config.cloneDir);
    expect(body.repos.find((r) => r.full_name === 'acme/ws-cloned')).toMatchObject({
      clone_path: '/tmp/x',
      cloned: true,
      last_polled_at: null,
    });
    await app.close();
  });

  it('POST /repos/:id/poll syncs PRs, bumps last_polled_at, 404s an unknown repo', async () => {
    const app = await buildApp({ config: config(), db: pg.handle.db, overrides: { github: new MockGitHubClient() } });
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'polled', fullName: 'acme/polled' })
      .returning();
    const res = await app.inject({ method: 'POST', url: `/repos/${repo!.id}/poll` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ synced: 1, reviewTriggered: false });

    const ws = (await app.inject({ method: 'GET', url: '/workspace' })).json() as {
      repos: { id: string; last_polled_at: string | null }[];
    };
    expect(ws.repos.find((r) => r.id === repo!.id)!.last_polled_at).not.toBeNull();
    const pulls = (await app.inject({ method: 'GET', url: `/repos/${repo!.id}/pulls` })).json() as { number: number }[];
    expect(pulls.map((p) => p.number)).toEqual([482]);

    const missing = await app.inject({ method: 'POST', url: '/repos/00000000-0000-0000-0000-000000000000/poll' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
