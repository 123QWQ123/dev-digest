import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,1 +1,2 @@
 export const a = 1;
+export const b = 2;`;

const EMPTY_REVIEW: Review = { verdict: 'approve', summary: 'ok', score: 100, findings: [] };

/**
 * M2 skills — CRUD + versions + restore + import preview, the agent link set
 * (transactional replace, workspace guard), and the review pipeline: only the
 * effective skills (link enabled AND skill enabled) reach the prompt + trace.
 */
d('M2 skills (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let llm: MockLLMProvider;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW });
    return buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ diff: DIFF }),
        github: new MockGitHubClient(),
        llm: { openai: llm },
      },
    });
  }

  const body = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    description: 'Use when testing. Flag things.',
    type: 'rubric',
    body: `# ${name}\n\nRULE-${name}`,
    ...extra,
  });

  it('seed links the Test Quality Reviewer to its three skills, in order', async () => {
    const app = await makeApp();
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json();
    const tq = agents.find((a: { name: string }) => a.name === 'Test Quality Reviewer');
    expect(tq.skill_count).toBe(3);
    const links = (await app.inject({ method: 'GET', url: `/agents/${tq.id}/skills` })).json();
    expect(links.map((l: { name: string }) => l.name)).toEqual([
      'branch-coverage-gate',
      'corner-case-checklist',
      'mock-discipline',
    ]);
    // seeding again is idempotent and keeps links
    await seed(pg.handle.db);
    const again = (await app.inject({ method: 'GET', url: `/agents/${tq.id}/skills` })).json();
    expect(again).toHaveLength(3);
    await app.close();
  });

  it('CRUD, version bump rules, versions list, restore, 409 on duplicate name', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: body('crud-skill') });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({ version: 1, source: 'manual', enabled: true, agent_count: 0, agent_names: [] });

    const dup = await app.inject({ method: 'POST', url: '/skills', payload: body('crud-skill') });
    expect(dup.statusCode).toBe(409);

    const bad = await app.inject({ method: 'POST', url: '/skills', payload: body('Bad Name') });
    expect(bad.statusCode).toBe(422);

    // enabled-only → no new version
    const toggled = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { enabled: false } })
    ).json();
    expect(toggled).toMatchObject({ enabled: false, version: 1 });

    // body change → v2 with note
    const edited = (
      await app.inject({
        method: 'PUT',
        url: `/skills/${skill.id}`,
        payload: { body: 'NEW BODY', note: 'Tightened' },
      })
    ).json();
    expect(edited).toMatchObject({ version: 2, body: 'NEW BODY' });

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })
    ).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].note).toBe('Tightened');

    const restored = (
      await app.inject({ method: 'POST', url: `/skills/${skill.id}/versions/1/restore` })
    ).json();
    // Restore switches to the snapshot — no new history entry.
    expect(restored).toMatchObject({ version: 1, body: '# crud-skill\n\nRULE-crud-skill' });
    const afterRestore = (
      await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })
    ).json();
    expect(afterRestore.map((v: { version: number }) => v.version)).toEqual([2, 1]);

    // The next edit takes the next FREE number (v3), not current + 1 (v2 is taken).
    const reEdited = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { body: 'THIRD' } })
    ).json();
    expect(reEdited).toMatchObject({ version: 3, body: 'THIRD' });
    const v2 = (
      await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions/2` })
    ).json();
    expect(v2.body).toBe('NEW BODY');

    const missing = await app.inject({ method: 'POST', url: `/skills/${skill.id}/versions/99/restore` });
    expect(missing.statusCode).toBe(404);

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it('import preview parses a zip, lists ignored scripts, and persists nothing', async () => {
    const app = await makeApp();
    const before = (await pg.handle.db.select().from(t.skills)).length;
    const zip = zipSync({
      'pack/SKILL.md': strToU8('---\nname: imported-one\ndescription: Use when X.\n---\nBODY'),
      'pack/scripts/run.sh': strToU8('echo pwned'),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'pack.zip', content_base64: Buffer.from(zip).toString('base64') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      name: 'imported-one',
      body: 'BODY',
      ignored_files: ['pack/scripts/run.sh'],
    });
    expect((await pg.handle.db.select().from(t.skills)).length).toBe(before);

    const bad = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'x.zip', content_base64: Buffer.from('nope').toString('base64') },
    });
    expect(bad.statusCode).toBe(422);

    // Not base64 at all: rejected by the contract, never decoded into garbage bytes.
    const notB64 = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'x.md', content_base64: '%%% not base64 %%%' },
    });
    expect(notB64.statusCode).toBe(422);

    const saved = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { ...body('imported-one'), source: 'imported' },
    });
    expect(saved.json().source).toBe('imported');
    await app.close();
  });

  it('PUT /agents/:id/skills replaces the ordered set; foreign skills → 422', async () => {
    const app = await makeApp();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Linker', provider: 'openai', model: 'gpt-4.1', system_prompt: 'x' },
      })
    ).json();
    const a = (await app.inject({ method: 'POST', url: '/skills', payload: body('link-a') })).json();
    const b = (await app.inject({ method: 'POST', url: '/skills', payload: body('link-b') })).json();

    const put = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { items: [{ skill_id: b.id, enabled: true }, { skill_id: a.id, enabled: false }] },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().map((l: { name: string; enabled: boolean }) => [l.name, l.enabled])).toEqual([
      ['link-b', true],
      ['link-a', false],
    ]);

    // Only a ticked link counts as "connected" (matches the agent card's skill_count).
    const listed = (await app.inject({ method: 'GET', url: '/skills' })).json() as Array<{
      id: string;
      agent_count: number;
      agent_names: string[];
    }>;
    expect(listed.find((s) => s.id === b.id)).toMatchObject({
      agent_count: 1,
      agent_names: ['Linker'],
    });
    expect(listed.find((s) => s.id === a.id)).toMatchObject({ agent_count: 0, agent_names: [] });

    // A global off/on keeps the per-agent tick: while off the skill leaves the agent's
    // effective set (skill_count), and once back on it is active again where it was ticked.
    const linkB = async () =>
      ((await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json() as Array<{
        name: string;
        enabled: boolean;
        skill_enabled: boolean;
      }>).find((l) => l.name === 'link-b');
    const skillCount = async () =>
      (await app.inject({ method: 'GET', url: `/agents/${agent.id}` })).json().skill_count;
    await app.inject({ method: 'PUT', url: `/skills/${b.id}`, payload: { enabled: false } });
    expect(await linkB()).toMatchObject({ enabled: true, skill_enabled: false });
    expect(await skillCount()).toBe(0);
    await app.inject({ method: 'PUT', url: `/skills/${b.id}`, payload: { enabled: true } });
    expect(await linkB()).toMatchObject({ enabled: true, skill_enabled: true });
    expect(await skillCount()).toBe(1);

    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign',
        description: 'd',
        type: 'custom',
        source: 'manual',
        body: 'b',
      })
      .returning();
    const rejected = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { items: [{ skill_id: foreign!.id, enabled: true }] },
    });
    expect(rejected.statusCode).toBe(422);
    // nothing written on rejection
    const still = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json();
    expect(still).toHaveLength(2);
    await app.close();
  });

  it('POST /tokens/count counts with the trace tokenizer and caps the input', async () => {
    const app = await makeApp();
    const ok = await app.inject({ method: 'POST', url: '/tokens/count', payload: { text: 'hello world' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().tokens).toBeGreaterThan(0);
    const empty = await app.inject({ method: 'POST', url: '/tokens/count', payload: { text: '' } });
    expect(empty.json()).toEqual({ tokens: 0 });
    const tooBig = await app.inject({
      method: 'POST',
      url: '/tokens/count',
      payload: { text: 'x'.repeat(100_001) },
    });
    expect(tooBig.statusCode).toBe(422);
    await app.close();
  });

  it('a review renders only effective skills, in order, and traces them with tokens', async () => {
    const app = await makeApp();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Skilled', provider: 'openai', model: 'gpt-4.1', system_prompt: 'x' },
      })
    ).json();
    const mk = async (n: string) =>
      (await app.inject({ method: 'POST', url: '/skills', payload: body(n) })).json();
    const [on1, offLink, offSkill, on2] = [
      await mk('run-on-1'),
      await mk('run-off-link'),
      await mk('run-off-skill'),
      await mk('run-on-2'),
    ];
    await app.inject({ method: 'PUT', url: `/skills/${offSkill.id}`, payload: { enabled: false } });
    await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: {
        items: [
          { skill_id: on2.id, enabled: true },
          { skill_id: offLink.id, enabled: false },
          { skill_id: offSkill.id, enabled: true },
          { skill_id: on1.id, enabled: true },
        ],
      },
    });

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'skills-repo', fullName: 'acme/skills-repo' })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 7,
        title: 't',
        author: 'a',
        branch: 'f',
        base: 'main',
        headSha: 'abc',
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/a.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -1,1 +1,2 @@\n export const a = 1;\n+export const b = 2;',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr!.id}/review`,
      payload: { agentId: agent.id },
    });
    const runId = res.json().runs[0].run_id;
    const [run] = await waitForPrRuns(pg.handle.db, pr!.id, { expected: 1 });
    expect(run!.status).toBe('done');

    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    const skillsBlock: string = trace.prompt_assembly.skills;
    expect(skillsBlock).toContain('### run-on-2');
    expect(skillsBlock).toContain('### run-on-1');
    expect(skillsBlock.indexOf('run-on-2')).toBeLessThan(skillsBlock.indexOf('run-on-1'));
    expect(skillsBlock).not.toContain('run-off-link');
    expect(skillsBlock).not.toContain('run-off-skill');
    expect(trace.prompt_assembly.skills_used.map((s: { name: string }) => s.name)).toEqual([
      'run-on-2',
      'run-on-1',
    ]);
    expect(trace.prompt_tokens.skills).toBeGreaterThan(0);
    expect(trace.prompt_tokens.user).toBeGreaterThan(trace.prompt_tokens.skills);
    expect(trace.prompt_assembly.user).toContain('## Skills / rules');

    // ---- Stats: run_skills feeds pull rate; triaged findings feed accept rate.
    const [review] = await pg.handle.db.select().from(t.reviews).where(eq(t.reviews.runId, runId));
    await pg.handle.db.delete(t.findings).where(eq(t.findings.reviewId, review!.id));
    const finding = (
      title: string,
      extra: Partial<typeof t.findings.$inferInsert>,
    ): typeof t.findings.$inferInsert => ({
      reviewId: review!.id,
      file: 'src/a.ts',
      startLine: 2,
      endLine: 2,
      severity: 'WARNING',
      category: 'test',
      title,
      rationale: 'r',
      confidence: 0.9,
      ...extra,
    });
    await pg.handle.db.insert(t.findings).values([
      finding('accepted', { acceptedAt: new Date() }),
      finding('dismissed', { dismissedAt: new Date(), category: 'bug', severity: 'CRITICAL' }),
      finding('pending', {}),
    ]);

    const on1Stats = (await app.inject({ method: 'GET', url: `/skills/${on1.id}/stats` })).json();
    expect(on1Stats).toMatchObject({
      agent_runs: 1,
      runs_with_skill: 1,
      pull_rate: 1,
      accept_rate: 0.5,
      findings: 3,
      used_by: [{ id: agent.id, name: 'Skilled', enabled: true }],
    });
    expect(on1Stats.findings_by_category).toEqual([
      { category: 'test', count: 2 },
      { category: 'bug', count: 1 },
    ]);
    // Linked but disabled: counted in the denominator, never pulled, no findings.
    const offStats = (await app.inject({ method: 'GET', url: `/skills/${offLink.id}/stats` })).json();
    expect(offStats).toMatchObject({ agent_runs: 1, runs_with_skill: 0, pull_rate: 0, findings: 0 });
    expect(offStats.accept_rate).toBeNull();

    const listed = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(listed.find((s: { id: string }) => s.id === on1.id).stats).toEqual({
      pull_rate: 1,
      accept_rate: 0.5,
    });

    const agentStats = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/stats` })).json();
    expect(agentStats).toMatchObject({
      agent_name: 'Skilled',
      runs: 1,
      findings_total: 3,
      accepted: 1,
      dismissed: 1,
      pending: 1,
      accept_rate: 0.5,
      findings_by_severity: { CRITICAL: 1, WARNING: 2, SUGGESTION: 0 },
    });
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json();
    expect(agents.find((a: { id: string }) => a.id === agent.id).stats).toMatchObject({
      runs: 1,
      accept_rate: 0.5,
    });
    await app.close();
  });
});
