import type { PrStatus } from '@devdigest/shared';

/**
 * PR-list rollup helpers (pure — no DB / `this`, so they unit-test cleanly).
 *
 * The Pull Requests list shows, per PR: the latest review's SCORE, a FINDINGS
 * severity breakdown, and a review STATUS. The DB `status` column holds
 * GitHub's merge state (open/merged/closed); the review status
 * (needs_review / reviewed / stale) is DERIVED here for OPEN PRs from the
 * commit a review last ran against (`lastReviewedSha`) vs the PR head, plus age.
 */

/** Open PRs whose current head was reviewed but untouched this long read "stale". */
export const STALE_DAYS = 7;

export interface SeverityCounts {
  critical: number;
  warning: number;
  suggestion: number;
}

/** Tally finding severities (CRITICAL / WARNING / SUGGESTION) for one review. */
export function rollupSeverities(rows: { severity: string }[]): SeverityCounts {
  const c: SeverityCounts = { critical: 0, warning: 0, suggestion: 0 };
  for (const r of rows) {
    if (r.severity === 'CRITICAL') c.critical += 1;
    else if (r.severity === 'WARNING') c.warning += 1;
    else if (r.severity === 'SUGGESTION') c.suggestion += 1;
  }
  return c;
}

/**
 * Review-freshness status for the PR list. Merged/closed PRs keep their GitHub
 * merge state; open PRs map to:
 *  - `needs_review` — never reviewed, OR head moved since the last review
 *  - `stale`        — current head was reviewed but the PR is older than STALE_DAYS
 *  - `reviewed`     — current head reviewed and recent
 */
export function deriveReviewStatus(args: {
  /** DB `status` column = GitHub merge state (open/merged/closed). */
  ghStatus: string;
  lastReviewedSha: string | null;
  headSha: string;
  updatedAt: Date | null;
  now: number;
  staleDays?: number;
}): PrStatus {
  const { ghStatus, lastReviewedSha, headSha, updatedAt, now } = args;
  if (ghStatus === 'merged' || ghStatus === 'closed') return ghStatus as PrStatus;
  if (!lastReviewedSha || lastReviewedSha !== headSha) return 'needs_review';
  const staleMs = (args.staleDays ?? STALE_DAYS) * 86_400_000;
  if (updatedAt && now - updatedAt.getTime() > staleMs) return 'stale';
  return 'reviewed';
}

/** One `agent_runs` row as needed for the PR-list cost rollup. */
export interface RunCostRow {
  prId: string;
  costUsd: number | null;
}

/**
 * PR-list COST = total spend on the PR (M1): the sum of the known (non-null)
 * `cost_usd` of EVERY run — reruns included, any agent, any status (failed /
 * cancelled runs store NULL today, so they add nothing). A PR with runs but no
 * known cost maps to null (rendered "—", never "$0.00"); a PR without runs has
 * no entry.
 */
export function totalPrCost(rows: RunCostRow[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const r of rows) {
    if (r.costUsd == null) {
      if (!out.has(r.prId)) out.set(r.prId, null);
      continue;
    }
    out.set(r.prId, (out.get(r.prId) ?? 0) + r.costUsd);
  }
  return out;
}

/** One `reviews` row as needed for the PR-list FINDINGS rollup. */
export interface ReviewRoundRow {
  id: string;
  prId: string;
  agentId: string | null;
}

/**
 * PR-list FINDINGS = the "latest review round": per (PR, agent) only the
 * NEWEST review counts; older reruns of the same agent are ignored. Rows MUST
 * be ordered newest-first. Reviews whose agent was deleted share one `null`
 * bucket. Returns PR id → review ids (newest-first); PRs without reviews have
 * no entry.
 */
export function latestReviewPerAgent(rows: ReviewRoundRow[]): Map<string, string[]> {
  const seen = new Set<string>();
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const key = `${r.prId}\u0000${r.agentId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = out.get(r.prId);
    if (ids) ids.push(r.id);
    else out.set(r.prId, [r.id]);
  }
  return out;
}
