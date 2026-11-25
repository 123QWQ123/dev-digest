/**
 * PR-list rollup helpers (`modules/pulls/status.ts`) — the pure derivation that
 * decides each PR's review STATUS and tallies its FINDINGS for the list. The DB
 * `status` column holds GitHub's merge state; the review status
 * (needs_review / reviewed / stale) is derived here from head vs lastReviewedSha
 * + age, so it gets unit coverage independent of the route's queries.
 */
import { describe, it, expect } from 'vitest';
import { deriveReviewStatus, latestReviewPerAgent, rollupSeverities, totalPrCost, STALE_DAYS } from '../src/modules/pulls/status.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 11);

describe('deriveReviewStatus', () => {
  it('needs_review when never reviewed, or when head moved since the last review', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: null, headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'old', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
  });

  it('reviewed when the current head was reviewed and the PR is recent', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now - DAY), now }),
    ).toBe('reviewed');
  });

  it('stale when the current head was reviewed but the PR is older than STALE_DAYS', () => {
    expect(
      deriveReviewStatus({
        ghStatus: 'open',
        lastReviewedSha: 'abc',
        headSha: 'abc',
        updatedAt: new Date(now - (STALE_DAYS + 1) * DAY),
        now,
      }),
    ).toBe('stale');
  });

  it('keeps merged/closed regardless of review state', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'merged', lastReviewedSha: null, headSha: 'abc', updatedAt: null, now }),
    ).toBe('merged');
    expect(
      deriveReviewStatus({ ghStatus: 'closed', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('closed');
  });
});

describe('rollupSeverities', () => {
  it('tallies findings into critical / warning / suggestion buckets (ignores unknown)', () => {
    expect(
      rollupSeverities([
        { severity: 'CRITICAL' },
        { severity: 'CRITICAL' },
        { severity: 'WARNING' },
        { severity: 'SUGGESTION' },
        { severity: 'WEIRD' },
      ]),
    ).toEqual({ critical: 2, warning: 1, suggestion: 1 });
  });

  it('is all-zero for no findings', () => {
    expect(rollupSeverities([])).toEqual({ critical: 0, warning: 0, suggestion: 0 });
  });
});

describe('totalPrCost (M1 PR-list COST)', () => {
  const run = (prId: string, costUsd: number | null) => ({ prId, costUsd });

  it('sums every run of the PR, reruns included', () => {
    const m = totalPrCost([run('p1', 0.002), run('p1', 0.003), run('p1', 0.005), run('p2', 0.001)]);
    expect(m.get('p1')).toBeCloseTo(0.01);
    expect(m.get('p2')).toBeCloseTo(0.001);
  });

  it('skips unknown costs, but keeps a known 0 distinct from unknown', () => {
    expect(totalPrCost([run('p1', null), run('p1', 0.001)]).get('p1')).toBeCloseTo(0.001);
    expect(totalPrCost([run('p1', 0.001), run('p1', null)]).get('p1')).toBeCloseTo(0.001);
    expect(totalPrCost([run('p1', null)]).get('p1')).toBeNull();
    expect(totalPrCost([run('p1', 0)]).get('p1')).toBe(0);
  });

  it('has no entry for a PR without runs', () => {
    expect(totalPrCost([]).has('p1')).toBe(false);
  });
});

describe('latestReviewPerAgent (M1 PR-list FINDINGS)', () => {
  const rv = (id: string, prId: string, agentId: string | null) => ({ id, prId, agentId });

  it('keeps the newest review of EVERY agent, dropping older reruns', () => {
    // newest-first: general rerun r3 supersedes r1; security r2 still counts
    const m = latestReviewPerAgent([rv('r3', 'p1', 'general'), rv('r2', 'p1', 'security'), rv('r1', 'p1', 'general')]);
    expect(m.get('p1')).toEqual(['r3', 'r2']);
  });

  it('groups per PR and buckets deleted agents (null) together', () => {
    const m = latestReviewPerAgent([rv('a', 'p1', null), rv('b', 'p2', 'x'), rv('c', 'p1', null)]);
    expect(m.get('p1')).toEqual(['a']);
    expect(m.get('p2')).toEqual(['b']);
    expect(m.has('p3')).toBe(false);
  });
});
