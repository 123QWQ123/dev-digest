import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PrDetail, PrMeta } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { PullRow, RepoRow } from '../../db/rows.js';

export type { PullRow, RepoRow };

/** Newest-first `kind='review'` rows of a set of PRs (input to the list rollups). */
export interface ReviewScoreRow {
  id: string;
  prId: string;
  agentId: string | null;
  score: number | null;
}

/**
 * Pulls data-access. The ONLY place that queries `pull_requests`, `pr_files`
 * and `pr_commits` for the pulls module, plus the read-only rollup inputs
 * (`reviews`, `findings`, `agent_runs`) for the PR list. Workspace scoping is
 * enforced here on every entry point that takes a user-supplied id.
 */
export class PullsRepository {
  constructor(private db: Db) {}

  async findRepo(workspaceId: string, repoId: string): Promise<RepoRow | undefined> {
    const [repo] = await this.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return repo;
  }

  /** PR (workspace-scoped) + its repo, or undefined when either is missing. */
  async findPrWithRepo(
    workspaceId: string,
    prId: string,
  ): Promise<{ pr: PullRow; repo: RepoRow | undefined } | undefined> {
    const [row] = await this.db
      .select({ pr: t.pullRequests, repo: t.repos })
      .from(t.pullRequests)
      .leftJoin(t.repos, eq(t.repos.id, t.pullRequests.repoId))
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
    if (!row) return undefined;
    return { pr: row.pr, repo: row.repo ?? undefined };
  }

  /**
   * Idempotent import of GitHub's PR list (unique repo_id+number). New PRs are
   * inserted; existing ones get title/head/status/updatedAt refreshed. One
   * statement for the whole page instead of one round-trip per PR.
   */
  async upsertFromGitHub(workspaceId: string, repoId: string, pulls: PrMeta[]): Promise<void> {
    // ON CONFLICT can't touch the same row twice in one statement → last wins,
    // matching the previous one-by-one loop.
    const byNumber = new Map(pulls.map((pr) => [pr.number, pr]));
    if (byNumber.size === 0) return;
    await this.db
      .insert(t.pullRequests)
      .values(
        [...byNumber.values()].map((pr) => ({
          workspaceId,
          repoId,
          number: pr.number,
          title: pr.title,
          author: pr.author,
          branch: pr.branch,
          base: pr.base,
          headSha: pr.head_sha,
          additions: pr.additions,
          deletions: pr.deletions,
          filesCount: pr.files_count,
          status: pr.status,
          openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
          updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
        })),
      )
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        set: {
          title: sql`excluded.title`,
          headSha: sql`excluded.head_sha`,
          status: sql`excluded.status`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async markPolled(repoId: string, at: Date = new Date()): Promise<void> {
    await this.db.update(t.repos).set({ lastPolledAt: at }).where(eq(t.repos.id, repoId));
  }

  listByRepo(repoId: string): Promise<PullRow[]> {
    return this.db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
  }

  async updateDiffStats(
    prId: string,
    stats: { additions: number; deletions: number; filesCount: number },
  ): Promise<void> {
    await this.db.update(t.pullRequests).set(stats).where(eq(t.pullRequests.id, prId));
  }

  /** `kind='review'` rows of the given PRs, newest first. */
  listReviewScores(prIds: string[]): Promise<ReviewScoreRow[]> {
    return this.db
      .select({ id: t.reviews.id, prId: t.reviews.prId, agentId: t.reviews.agentId, score: t.reviews.score })
      .from(t.reviews)
      .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
      .orderBy(desc(t.reviews.createdAt));
  }

  /** Every run's cost on the given PRs (any agent, any status). */
  async listRunCosts(
    workspaceId: string,
    prIds: string[],
  ): Promise<{ prId: string; costUsd: number | null }[]> {
    const rows = await this.db
      .select({ prId: t.agentRuns.prId, costUsd: t.agentRuns.costUsd })
      .from(t.agentRuns)
      .where(and(eq(t.agentRuns.workspaceId, workspaceId), inArray(t.agentRuns.prId, prIds)));
    return rows.filter((r): r is { prId: string; costUsd: number | null } => r.prId != null);
  }

  listFindingSeverities(reviewIds: string[]): Promise<{ reviewId: string; severity: string }[]> {
    return this.db
      .select({ reviewId: t.findings.reviewId, severity: t.findings.severity })
      .from(t.findings)
      .where(inArray(t.findings.reviewId, reviewIds));
  }

  /**
   * Replace a PR's files + commits and refresh body/diff stats from a GitHub
   * detail — atomically, so a failure midway leaves the previous snapshot intact.
   */
  async replaceDetail(prId: string, detail: PrDetail): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
      if (detail.files.length > 0) {
        await tx.insert(t.prFiles).values(
          detail.files.map((f) => ({
            prId,
            path: f.path,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch ?? null,
          })),
        );
      }
      await tx.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
      if (detail.commits.length > 0) {
        await tx.insert(t.prCommits).values(
          detail.commits.map((c) => ({
            prId,
            sha: c.sha,
            message: c.message,
            author: c.author,
            committedAt: c.committed_at ? new Date(c.committed_at) : null,
          })),
        );
      }
      await tx
        .update(t.pullRequests)
        .set({
          body: detail.body ?? null,
          // Diff stats aren't on GitHub's PR-list payload — backfill them from
          // the detail fetch so the Pull Requests list shows real size/files.
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.files_count,
        })
        .where(eq(t.pullRequests.id, prId));
    });
  }

  /** The persisted (offline) PR detail, mapped to the API contract. */
  async loadPersistedDetail(pr: PullRow): Promise<PrDetail & { id: string }> {
    const [files, commits] = await Promise.all([
      this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id)),
      this.db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id)),
    ]);
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      author: pr.author,
      branch: pr.branch,
      base: pr.base,
      head_sha: pr.headSha,
      additions: pr.additions,
      deletions: pr.deletions,
      files_count: pr.filesCount,
      status: pr.status as PrDetail['status'],
      opened_at: pr.openedAt?.toISOString() ?? null,
      updated_at: pr.updatedAt?.toISOString() ?? null,
      body: pr.body ?? null,
      files: files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? null,
      })),
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        author: c.author,
        committed_at: c.committedAt?.toISOString() ?? null,
      })),
    };
  }
}
