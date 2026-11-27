/**
 * JobRunner (platform/jobs.ts) against an in-memory JobStore — the queue/state
 * machine is testable without Postgres now that persistence sits behind a port.
 */
import { describe, it, expect } from 'vitest';
import { JobRunner, type JobStore } from '../src/platform/jobs.js';

function memoryStore() {
  const events: string[] = [];
  const store: JobStore = {
    async create(_ws, kind) {
      events.push(`create:${kind}`);
      return 'job-1';
    },
    async markRunning(id) {
      events.push(`running:${id}`);
    },
    async setAttempts(id, n) {
      events.push(`attempts:${id}:${n}`);
    },
    async markDone(id) {
      events.push(`done:${id}`);
    },
    async markFailed(id, error) {
      events.push(`failed:${id}:${error}`);
    },
  };
  return { store, events };
}

describe('JobRunner', () => {
  it('persists queued → running → done for a successful handler', async () => {
    const { store, events } = memoryStore();
    const runner = new JobRunner(store, { retries: 0 });
    let got: unknown;
    runner.register('clone', async (payload, ctx) => {
      got = { payload, jobId: ctx.jobId };
    });
    const job = await runner.enqueue('ws', 'clone', { repo: 'x' });
    await job.done;
    expect(job.id).toBe('job-1');
    expect(got).toEqual({ payload: { repo: 'x' }, jobId: 'job-1' });
    expect(events).toEqual(['create:clone', 'running:job-1', 'attempts:job-1:1', 'done:job-1']);
  });

  it('persists the failure, rejects `done`, and never crashes on fire-and-forget', async () => {
    const { store, events } = memoryStore();
    const runner = new JobRunner(store, { retries: 0 });
    runner.register('clone', async () => {
      throw new Error('repository not found');
    });
    const job = await runner.enqueue('ws', 'clone', {});
    await expect(job.done).rejects.toThrow('repository not found');
    await runner.onIdle();
    expect(events.at(-1)).toBe('failed:job-1:repository not found');
  });

  it('rejects an unknown job kind before touching the store', async () => {
    const { store, events } = memoryStore();
    const runner = new JobRunner(store);
    await expect(runner.enqueue('ws', 'nope', {})).rejects.toThrow("No job handler registered for kind 'nope'");
    expect(events).toEqual([]);
  });
});
