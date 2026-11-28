import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionRow, RepoRow } from '../../db/rows.js';

export type { ConventionRow, RepoRow };

/** A verified candidate ready to insert. */
export interface NewConvention {
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
  confidence: number;
}

/**
 * M2 Conventions Extractor — data access for `conventions`. Workspace-scoped:
 * every read/write filters on workspace_id.
 */
export class ConventionsRepository {
  constructor(private db: Db) {}

  async findRepo(workspaceId: string, repoId: string): Promise<RepoRow | undefined> {
    const [repo] = await this.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return repo;
  }

  /** Candidates of a repo: accepted first, then by confidence. */
  list(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      .orderBy(desc(t.conventions.confidence), asc(t.conventions.rule));
  }

  async update(
    workspaceId: string,
    id: string,
    patch: { rule?: string; accepted?: boolean },
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.accepted !== undefined ? { accepted: patch.accepted } : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  /**
   * Re-scan: drop the repo's NON-accepted candidates and insert the new ones,
   * atomically. Accepted candidates survive every re-scan.
   */
  async replaceCandidates(workspaceId: string, repoId: string, rows: NewConvention[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventions)
        .where(
          and(
            eq(t.conventions.workspaceId, workspaceId),
            eq(t.conventions.repoId, repoId),
            eq(t.conventions.accepted, false),
          ),
        );
      if (rows.length === 0) return;
      await tx.insert(t.conventions).values(rows.map((r) => ({ ...r, workspaceId, repoId })));
    });
  }
}
