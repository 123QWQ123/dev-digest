import type { GitHubClient, PrDetail, PrMeta, PrReviewComment, PrCommentInput } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { PullsRepository, PullRow, RepoRow } from './repository.js';
import {
  deriveReviewStatus,
  latestReviewPerAgent,
  latestScorePerPr,
  roundSeverities,
  totalPrCost,
  type SeverityCounts,
} from './status.js';
import { DIFF_STATS_BACKFILL_LIMIT } from './constants.js';

/** The slice of a pino/Fastify logger the service uses. */
export interface PullsLogger {
  warn: (obj: unknown, msg?: string) => void;
}

export interface PullsDeps {
  repo: PullsRepository;
  /** Resolves the GitHub adapter; rejects when no token is configured. */
  github: () => Promise<GitHubClient>;
  log: PullsLogger;
}

/**
 * F1 — pulls use cases. PR import via the GitHub port (list + per-PR detail),
 * local-first: GitHub is used to refresh when reachable, the persisted copy is
 * always served when it isn't. Inline review comments are proxied live.
 */
export class PullsService {
  constructor(private deps: PullsDeps) {}

  private async tryGitHub(onUnavailable: string): Promise<GitHubClient | null> {
    try {
      return await this.deps.github();
    } catch (err) {
      this.deps.log.warn({ err }, onUnavailable);
      return null;
    }
  }

  /** PR list for a repo: sync from GitHub when possible, then roll up score / round / cost. */
  async listForRepo(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const { repo: store, log } = this.deps;
    const repo = await store.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    const gh = await this.tryGitHub('GitHub client unavailable (no token / offline); serving persisted PRs');
    if (gh) {
      try {
        const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
        await store.upsertFromGitHub(workspaceId, repo.id, pulls);
      } catch (err) {
        log.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await store.listByRepo(repo.id);
    if (gh) await this.backfillDiffStats(gh, repo, rows);
    return this.withRollups(workspaceId, rows);
  }

  /**
   * MANUAL poll: sync the PR list from GitHub (new/updated PRs appear, head_sha
   * updates) and bump `last_polled_at`. Never triggers a review. Unlike the
   * list read, a GitHub failure here is surfaced to the caller.
   */
  async pollRepo(workspaceId: string, repoId: string): Promise<{ synced: number; reviewTriggered: false }> {
    const repo = await this.deps.repo.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    const gh = await this.deps.github();
    const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
    await this.deps.repo.upsertFromGitHub(workspaceId, repo.id, pulls);
    await this.deps.repo.markPolled(repo.id);
    return { synced: pulls.length, reviewTriggered: false };
  }

  /**
   * Diff stats aren't on GitHub's PR-list payload, so freshly-imported PRs land
   * with zeroed size/diff. Backfill them from the detail endpoint, capped per
   * request (each is a detail fetch) — the periodic refetch chips away at the rest.
   * Mutates `rows` so the current response already shows the real numbers.
   */
  private async backfillDiffStats(gh: GitHubClient, repo: RepoRow, rows: PullRow[]): Promise<void> {
    const needStats = rows
      .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
      .slice(0, DIFF_STATS_BACKFILL_LIMIT);
    for (const r of needStats) {
      try {
        const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, r.number);
        const stats = { additions: detail.additions, deletions: detail.deletions, filesCount: detail.files_count };
        await this.deps.repo.updateDiffStats(r.id, stats);
        Object.assign(r, stats);
      } catch (err) {
        this.deps.log.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
      }
    }
  }

  /**
   * SCORE = the PR's latest review. FINDINGS = the latest review round (newest
   * review of EVERY agent, severities summed). COST = total spend over every run.
   * Computed on read; the list is small, so IN-queries + pure grouping are cheap.
   */
  private async withRollups(workspaceId: string, rows: PullRow[]): Promise<PrMeta[]> {
    const store = this.deps.repo;
    const prIds = rows.map((r) => r.id);
    let latestScore = new Map<string, { score: number | null }>();
    let rounds = new Map<string, { reviewIds: string[]; counts: SeverityCounts }>();
    let costByPr = new Map<string, number | null>();
    if (prIds.length > 0) {
      const [reviewRows, runRows] = await Promise.all([
        store.listReviewScores(prIds),
        store.listRunCosts(workspaceId, prIds),
      ]);
      latestScore = latestScorePerPr(reviewRows);
      const roundIds = latestReviewPerAgent(reviewRows);
      const allRoundIds = [...roundIds.values()].flat();
      if (allRoundIds.length > 0) {
        rounds = roundSeverities(roundIds, await store.listFindingSeverities(allRoundIds));
      }
      costByPr = totalPrCost(runRows);
    }

    const now = Date.now();
    return rows.map((r) => {
      const review = latestScore.get(r.id);
      const round = rounds.get(r.id);
      return {
        id: r.id,
        number: r.number,
        title: r.title,
        author: r.author,
        branch: r.branch,
        base: r.base,
        head_sha: r.headSha,
        additions: r.additions,
        deletions: r.deletions,
        files_count: r.filesCount,
        status: deriveReviewStatus({
          ghStatus: r.status,
          lastReviewedSha: r.lastReviewedSha,
          headSha: r.headSha,
          updatedAt: r.updatedAt,
          now,
        }),
        opened_at: r.openedAt?.toISOString() ?? null,
        updated_at: r.updatedAt?.toISOString() ?? null,
        score: review ? review.score : null,
        latest_round: round ? { review_ids: round.reviewIds, ...round.counts } : null,
        cost_usd: costByPr.get(r.id) ?? null,
      };
    });
  }

  private async requirePrAndRepo(workspaceId: string, prId: string): Promise<{ pr: PullRow; repo: RepoRow }> {
    const found = await this.deps.repo.findPrWithRepo(workspaceId, prId);
    if (!found) throw new NotFoundError('Pull request not found');
    if (!found.repo) throw new NotFoundError('Repo not found');
    return { pr: found.pr, repo: found.repo };
  }

  /**
   * Full PR detail. Local-first: refresh from GitHub when reachable (files +
   * commits replaced atomically); otherwise — or if the refresh fails at any
   * step — serve the persisted files/commits/body so PR detail works offline.
   */
  async getDetail(workspaceId: string, prId: string): Promise<PrDetail & { id: string }> {
    const { pr, repo } = await this.requirePrAndRepo(workspaceId, prId);
    try {
      const gh = await this.deps.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);
      await this.deps.repo.replaceDetail(pr.id, detail);
      return { ...detail, id: pr.id };
    } catch (err) {
      this.deps.log.warn({ err }, 'GitHub PR detail refresh skipped (no token / offline); serving persisted detail');
      return this.deps.repo.loadPersistedDetail(pr);
    }
  }

  /** Existing inline review comments, proxied live; [] when GitHub is unavailable. */
  async listComments(workspaceId: string, prId: string): Promise<PrReviewComment[]> {
    const { pr, repo } = await this.requirePrAndRepo(workspaceId, prId);
    const gh = await this.tryGitHub('GitHub client unavailable; serving no PR comments');
    if (!gh) return [];
    try {
      return await gh.listReviewComments({ owner: repo.owner, name: repo.name }, pr.number);
    } catch (err) {
      this.deps.log.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  /** Post an inline comment pinned to the PR head sha. */
  async createComment(workspaceId: string, prId: string, input: PrCommentInput): Promise<PrReviewComment> {
    const { pr, repo } = await this.requirePrAndRepo(workspaceId, prId);
    let gh: GitHubClient;
    try {
      gh = await this.deps.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment({ owner: repo.owner, name: repo.name }, pr.number, {
        commitId: pr.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }
}
