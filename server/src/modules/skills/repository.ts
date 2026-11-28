import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
import type { SkillSource, SkillType } from '@devdigest/shared';
import { INITIAL_SKILL_VERSION } from './constants.js';

export type { SkillRow, SkillVersionRow };

/**
 * M2 — skills data-access. Owns `skills` and `skill_versions`. The agent side of
 * the `agent_skills` link table (link/enable/order) belongs to the agents
 * repository; here it is only read to list the linking agents. Disabling a skill
 * globally leaves the per-agent ticks alone, so re-enabling brings them back.
 * Workspace-scoped throughout.
 */

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled?: boolean;
  note?: string | null;
  /** Files the skill was derived from (extracted conventions). */
  evidenceFiles?: string[] | null;
}

export interface SkillContent {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
}

/**
 * A skill with the names of the agents that have it ticked (`agent_skills.enabled`),
 * sorted by name. An unticked link is "not connected" — same as the agent card's
 * `skill_count`; the skill's own global toggle is shown separately, so it isn't filtered here.
 */
export interface SkillWithCount extends SkillRow {
  agentNames: string[];
}

/** Thrown when (workspace_id, name) is already taken. The service maps it to 409. */
export class DuplicateSkillNameError extends Error {
  constructor(name: string) {
    super(`A skill named "${name}" already exists`);
    this.name = 'DuplicateSkillNameError';
  }
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | undefined;
  return e?.code === '23505' || e?.cause?.code === '23505';
}

/** Completed runs in the window that either link or used a skill. */
export interface SkillRunUsage {
  skillId: string;
  runs: number;
  usedRuns: number;
}

/** Findings of runs that used a skill, per category, with triage counts. */
export interface SkillFindingUsage {
  skillId: string;
  category: string;
  findings: number;
  accepted: number;
  dismissed: number;
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export class SkillsRepository {
  constructor(private db: Db) {}

  /** `array_agg` over a LEFT JOIN yields `{NULL}` for an unlinked skill — FILTER drops it. */
  private agentNamesCol = sql<string[]>`coalesce(
    array_agg(${t.agents.name} order by ${t.agents.name}) filter (where ${t.agents.id} is not null),
    '{}'
  )`;

  async list(workspaceId: string): Promise<SkillWithCount[]> {
    const rows = await this.db
      .select({ skill: t.skills, agentNames: this.agentNamesCol })
      .from(t.skills)
      .leftJoin(
        t.agentSkills,
        and(eq(t.agentSkills.skillId, t.skills.id), eq(t.agentSkills.enabled, true)),
      )
      .leftJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
      .where(eq(t.skills.workspaceId, workspaceId))
      .groupBy(t.skills.id)
      .orderBy(asc(t.skills.name));
    return rows.map((r) => ({ ...r.skill, agentNames: r.agentNames }));
  }

  async getById(workspaceId: string, id: string): Promise<SkillWithCount | undefined> {
    const [row] = await this.db
      .select({ skill: t.skills, agentNames: this.agentNamesCol })
      .from(t.skills)
      .leftJoin(
        t.agentSkills,
        and(eq(t.agentSkills.skillId, t.skills.id), eq(t.agentSkills.enabled, true)),
      )
      .leftJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .groupBy(t.skills.id);
    return row ? { ...row.skill, agentNames: row.agentNames } : undefined;
  }

  /** Insert a skill AND its v1 snapshot, atomically. */
  async insert(values: InsertSkill): Promise<SkillRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(t.skills)
          .values({
            workspaceId: values.workspaceId,
            name: values.name,
            description: values.description,
            type: values.type,
            source: values.source,
            body: values.body,
            enabled: values.enabled ?? true,
            evidenceFiles: values.evidenceFiles ?? null,
            version: INITIAL_SKILL_VERSION,
          })
          .returning();
        await this.snapshot(tx, row!, values.note ?? null);
        return row!;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new DuplicateSkillNameError(values.name);
      throw err;
    }
  }

  /**
   * Update a skill. When `bumpVersion` is set the skill gets the NEXT FREE version
   * number (max snapshot + 1, not current + 1: after a restore the current version
   * can sit below the newest snapshot) and the new content is snapshotted into
   * skill_versions in the same transaction.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: SkillContent & { enabled?: boolean },
    opts: { bumpVersion: boolean; note?: string | null },
  ): Promise<SkillRow | undefined> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .update(t.skills)
          .set({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.type !== undefined ? { type: patch.type } : {}),
            ...(patch.body !== undefined ? { body: patch.body } : {}),
            ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
            ...(opts.bumpVersion
              ? {
                  version: sql`(SELECT coalesce(max(${t.skillVersions.version}), 0) + 1
                    FROM ${t.skillVersions} WHERE ${t.skillVersions.skillId} = ${id})`,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
          .returning();
        if (row && opts.bumpVersion) await this.snapshot(tx, row, opts.note ?? null);
        return row;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new DuplicateSkillNameError(patch.name ?? '');
      throw err;
    }
  }

  /**
   * Restore = point the skill at an existing snapshot: copy its content and set
   * `version` to it. No new snapshot is written — history stays as it was.
   */
  async switchToVersion(
    workspaceId: string,
    id: string,
    snap: SkillVersionRow,
  ): Promise<SkillRow | undefined> {
    try {
      const [row] = await this.db
        .update(t.skills)
        .set({
          name: snap.name,
          description: snap.description,
          type: snap.type,
          body: snap.body,
          version: snap.version,
          updatedAt: new Date(),
        })
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();
      return row;
    } catch (err) {
      if (isUniqueViolation(err)) throw new DuplicateSkillNameError(snap.name);
      throw err;
    }
  }

  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }

  private async snapshot(tx: Tx, row: SkillRow, note: string | null): Promise<void> {
    await tx
      .insert(t.skillVersions)
      .values({
        skillId: row.id,
        version: row.version,
        name: row.name,
        description: row.description,
        type: row.type,
        body: row.body,
        note,
      })
      .onConflictDoNothing();
  }

  // ---- usage stats (M2) ----------------------------------------------------
  // A run "counts" for a skill when its agent currently links the skill OR the
  // run rendered it (run_skills) — so unlinking later doesn't erase history.

  async runUsage(workspaceId: string, windowDays: number, skillId?: string): Promise<SkillRunUsage[]> {
    const rows = await this.db.execute<{ skill_id: string; runs: number; used_runs: number }>(sql`
      SELECT s.id AS skill_id,
             count(*)::int AS runs,
             count(*) FILTER (WHERE rs.run_id IS NOT NULL)::int AS used_runs
      FROM ${t.skills} s
      JOIN ${t.agentRuns} r
        ON r.workspace_id = s.workspace_id
       AND r.status = 'done'
       AND r.ran_at >= now() - make_interval(days => ${windowDays})
      LEFT JOIN ${t.runSkills} rs ON rs.run_id = r.id AND rs.skill_id = s.id
      WHERE s.workspace_id = ${workspaceId}
        ${skillId ? sql`AND s.id = ${skillId}` : sql``}
        AND (rs.run_id IS NOT NULL OR EXISTS (
          SELECT 1 FROM ${t.agentSkills} l WHERE l.skill_id = s.id AND l.agent_id = r.agent_id))
      GROUP BY s.id
    `);
    return rows.map((r) => ({ skillId: r.skill_id, runs: Number(r.runs), usedRuns: Number(r.used_runs) }));
  }

  async findingUsage(
    workspaceId: string,
    windowDays: number,
    skillId?: string,
  ): Promise<SkillFindingUsage[]> {
    const rows = await this.db.execute<{
      skill_id: string;
      category: string;
      findings: number;
      accepted: number;
      dismissed: number;
    }>(sql`
      SELECT rs.skill_id, f.category,
             count(*)::int AS findings,
             count(*) FILTER (WHERE f.accepted_at IS NOT NULL)::int AS accepted,
             count(*) FILTER (WHERE f.dismissed_at IS NOT NULL)::int AS dismissed
      FROM ${t.runSkills} rs
      JOIN ${t.agentRuns} r ON r.id = rs.run_id
      JOIN ${t.reviews} rv ON rv.run_id = r.id
      JOIN ${t.findings} f ON f.review_id = rv.id
      WHERE r.workspace_id = ${workspaceId}
        AND r.status = 'done'
        AND r.ran_at >= now() - make_interval(days => ${windowDays})
        ${skillId ? sql`AND rs.skill_id = ${skillId}` : sql``}
      GROUP BY rs.skill_id, f.category
    `);
    return rows.map((r) => ({
      skillId: r.skill_id,
      category: r.category,
      findings: Number(r.findings),
      accepted: Number(r.accepted),
      dismissed: Number(r.dismissed),
    }));
  }

  /** Agents linking the skill (any link state), by name. */
  linkedAgents(skillId: string): Promise<{ id: string; name: string; enabled: boolean }[]> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
      .where(eq(t.agentSkills.skillId, skillId))
      .orderBy(asc(t.agents.name));
  }
}
