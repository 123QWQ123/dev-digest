import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import type { StructuredRequest, StructuredResult } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const FILES: Record<string, string> = {
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
  'src/api/users.ts': [
    'export async function load(id: string) {',
    '  const user = await db.users.find(id);',
    '  const posts = await db.posts.findMany({ userId: id });',
    '  return { user, posts };',
    '}',
  ].join('\n'),
  'src/lib/redis.ts': 'export const redis = new Redis(config.redisUrl);',
};

const GROUNDED = {
  rule: 'Use async/await instead of .then() chains',
  evidence_path: 'src/api/users.ts',
  evidence_snippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId: id });',
  confidence: 0.91,
};
const REDIS = {
  rule: 'Redis access goes through the src/lib/redis.ts singleton',
  evidence_path: 'src/lib/redis.ts',
  evidence_snippet: 'export const redis = new Redis(config.redisUrl);',
  confidence: 0.85,
};
const INVENTED_SNIPPET = { ...REDIS, rule: 'Handlers return Result<T>', evidence_snippet: 'return ok(items);' };
const UNSENT_FILE = { ...REDIS, rule: 'Secrets from env', evidence_path: '.env' };

/** A RepoIntel stub — the extractor only calls getConventionSamples. */
function repoIntelStub(paths: string[]): RepoIntel {
  return { getConventionSamples: async () => paths } as unknown as RepoIntel;
}

/** Holds completeStructured until `release()` — to observe an in-flight extraction. */
class GatedLLM extends MockLLMProvider {
  private gate!: () => void;
  readonly entered: Promise<void>;
  private markEntered!: () => void;
  constructor(fixture: unknown) {
    super('openai', { structuredBySchema: { ConventionExtraction: fixture } });
    this.entered = new Promise((r) => (this.markEntered = r));
  }
  release() {
    this.gate();
  }
  override async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const wait = new Promise<void>((r) => (this.gate = r));
    this.markEntered();
    await wait;
    return super.completeStructured(req);
  }
}

/**
 * M2 Conventions Extractor: sample → one structured LLM call → grounding →
 * store; accept/reject/edit; accepted → one convention/extracted skill.
 */
d('M2 conventions (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    const [repo] = await pg.handle.db.select().from(t.repos).where(eq(t.repos.workspaceId, workspaceId));
    repoId = repo!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });
  beforeEach(async () => {
    await pg.handle.db.delete(t.conventions);
    await pg.handle.db.update(t.repos).set({ clonePath: '/tmp/clone' }).where(eq(t.repos.id, repoId));
  });

  function makeApp(opts: { fixture?: unknown; samples?: string[]; llm?: MockLLMProvider } = {}) {
    const llm =
      opts.llm ??
      new MockLLMProvider('openai', {
        structuredBySchema: {
          ConventionExtraction: opts.fixture ?? { conventions: [GROUNDED, REDIS, INVENTED_SNIPPET, UNSENT_FILE] },
        },
      });
    const app = buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ files: FILES }),
        github: new MockGitHubClient(),
        llm: { openai: llm },
        repoIntel: repoIntelStub(opts.samples ?? ['src/api/users.ts', 'src/lib/redis.ts']),
      },
    });
    return { app, llm };
  }

  const extract = async (app: Awaited<ReturnType<typeof buildApp>>) =>
    app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });

  it('extracts, keeps only grounded candidates, reports lines and cost', async () => {
    const { app: appP, llm } = makeApp();
    const app = await appP;
    const res = await extract(app);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ sampled_files: 3, kept: 2, dropped: 2, cost_usd: 0.001, tokens_in: 100 });
    expect(body.items.map((c: { rule: string }) => c.rule).sort()).toEqual([GROUNDED.rule, REDIS.rule].sort());
    const users = body.items.find((c: { evidence_path: string }) => c.evidence_path === 'src/api/users.ts');
    expect(users).toMatchObject({ accepted: false, confidence: 0.91, evidence_lines: { start: 2, end: 3 } });
    expect(body.last_scan_at).toEqual(expect.any(String));

    // One structured call, with the files wrapped as untrusted data.
    const calls = llm.calls.filter((c) => c.method === 'completeStructured');
    expect(calls).toHaveLength(1);
    const req = calls[0]!.req as StructuredRequest<unknown>;
    expect(req.schemaName).toBe('ConventionExtraction');
    expect(req.messages[1]!.content).toContain('<untrusted source="src/api/users.ts">');
    expect(req.messages[1]!.content).toContain('<untrusted source="tsconfig.json">');

    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    expect(list.items).toHaveLength(2);
  });

  it('accept / reject / edit through PATCH; re-scan keeps accepted rows', async () => {
    const app = await makeApp().app;
    const { items } = (await extract(app)).json();
    const g = items.find((c: { rule: string }) => c.rule === GROUNDED.rule);

    const acc = await app.inject({ method: 'PATCH', url: `/conventions/${g.id}`, payload: { accepted: true, rule: 'Prefer async/await' } });
    expect(acc.statusCode).toBe(200);
    expect(acc.json()).toMatchObject({ accepted: true, rule: 'Prefer async/await' });

    const empty = await app.inject({ method: 'PATCH', url: `/conventions/${g.id}`, payload: {} });
    expect(empty.statusCode).toBe(422);

    // Re-scan: the unaccepted REDIS row is replaced; the accepted one survives.
    const again = (await extract(await makeApp({ fixture: { conventions: [REDIS] } }).app)).json();
    expect(again.items).toHaveLength(2);
    expect(again.items.find((c: { id: string }) => c.id === g.id)).toMatchObject({ accepted: true });

    // A new candidate repeating an accepted rule is skipped.
    const dup = (await extract(await makeApp({ fixture: { conventions: [{ ...GROUNDED, rule: 'prefer async/await.' }] } }).app)).json();
    expect(dup).toMatchObject({ kept: 0, dropped: 1 });
    expect(dup.items).toHaveLength(1);
  });

  it('builds one convention/extracted skill from the accepted candidates', async () => {
    const app = await makeApp().app;
    const payload = { name: 'payments-api-conventions', description: '2 house conventions', body: '# conventions\n\n- rule' };

    const none = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload });
    expect(none.statusCode).toBe(422);

    const { items } = (await extract(app)).json();
    for (const c of items) {
      await app.inject({ method: 'PATCH', url: `/conventions/${c.id}`, payload: { accepted: true } });
    }
    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'payments-api-conventions',
      type: 'convention',
      source: 'extracted',
      version: 1,
    });
    expect([...res.json().evidence_files].sort()).toEqual(['src/api/users.ts', 'src/lib/redis.ts']);

    const dup = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload });
    expect(dup.statusCode).toBe(409);
  });

  it('422 when the repo is not cloned or has no index; 404 for another workspace', async () => {
    const app = await makeApp({ samples: [] }).app;
    const noIndex = await extract(app);
    expect(noIndex.statusCode).toBe(422);
    expect(noIndex.json().error.code).toBe('index_not_ready');

    await pg.handle.db.update(t.repos).set({ clonePath: null }).where(eq(t.repos.id, repoId));
    const noClone = await extract(app);
    expect(noClone.json().error.code).toBe('repo_not_cloned');

    const [ws] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const [other] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: ws!.id, owner: 'x', name: 'y', fullName: 'x/y', clonePath: '/tmp/x' })
      .returning();
    expect((await app.inject({ method: 'GET', url: `/repos/${other!.id}/conventions` })).statusCode).toBe(404);
    expect((await extract(app)).statusCode).toBe(422);
    const [foreign] = await pg.handle.db
      .insert(t.conventions)
      .values({ workspaceId: ws!.id, repoId: other!.id, rule: 'r' })
      .returning();
    const patch = await app.inject({ method: 'PATCH', url: `/conventions/${foreign!.id}`, payload: { accepted: true } });
    expect(patch.statusCode).toBe(404);
    const [row] = await pg.handle.db.select().from(t.conventions).where(and(eq(t.conventions.id, foreign!.id)));
    expect(row!.accepted).toBe(false);
  });

  it('502 when the model call fails (quota, timeout)', async () => {
    const llm = new MockLLMProvider('openai', {});
    llm.completeStructured = async () => {
      throw new Error('429 You have no credits remaining');
    };
    const res = await extract(await makeApp({ llm }).app);
    expect(res.statusCode).toBe(502);
    expect(res.json().error.message).toContain('429 You have no credits remaining');
  });

  it('409 while an extraction for the same repo is in flight', async () => {
    const gated = new GatedLLM({ conventions: [GROUNDED] });
    const app = await makeApp({ llm: gated }).app;
    const first = extract(app);
    await gated.entered;
    const second = await extract(app);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('extraction_in_progress');
    gated.release();
    expect((await first).statusCode).toBe(200);
    // The lock is released afterwards.
    expect((await extract(await makeApp().app)).statusCode).toBe(200);
  });
});
