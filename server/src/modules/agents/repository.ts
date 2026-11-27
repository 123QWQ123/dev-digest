import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { CiFailOn, Provider, ReviewStrategy } from '@devdigest/shared';
import { DEFAULT_AGENT_DESCRIPTION, INITIAL_AGENT_VERSION } from './constants.js';
import { isConfigChange } from './helpers.js';

/**
 * A2 — agents data-access. Owns `agents`, `agent_versions`, and the
 * `agent_skills` link table (shared with A1's skills repository, but A2 owns the
 * agent side: link/reorder/list for an agent). Workspace-scoped throughout.
 */

import type { AgentRow, AgentVersionRow } from '../../db/rows.js';
export type { AgentRow, AgentVersionRow };

export interface InsertAgent {
  workspaceId: string;
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  systemPrompt: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
  createdBy?: string | null;
}

export interface UpdateAgent {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  systemPrompt?: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
  enabled?: boolean;
}

/** A skill linked to an agent (with its order + per-agent switch), joined from agent_skills. */
export interface LinkedSkillRow {
  skill: typeof t.skills.$inferSelect;
  order: number;
  enabled: boolean;
}

/** One entry of the ordered link set written by `setSkills`. */
export interface SkillLinkInput {
  skillId: string;
  enabled: boolean;
}

export interface AgentRunAggregate {
  agentId: string;
  runs: number;
  failed: number;
  avgCostUsd: number | null;
  totalCostUsd: number | null;
  avgDurationMs: number | null;
}

export interface AgentFindingAggregate {
  agentId: string;
  severity: string;
  findings: number;
  accepted: number;
  dismissed: number;
}

export class AgentsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<AgentRow[]> {
    return this.db.select().from(t.agents).where(eq(t.agents.workspaceId, workspaceId));
  }

  async listEnabled(workspaceId: string): Promise<AgentRow[]> {
    return this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.enabled, true)));
  }

  async getById(workspaceId: string, id: string): Promise<AgentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)));
    return row;
  }

  /** Delete an agent (scoped to workspace). Versions/skill-links cascade;
   *  agent_runs keep their history with agent_id set null. Returns false if
   *  no such agent existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
      .returning({ id: t.agents.id });
    return rows.length > 0;
  }

  /** Insert an agent AND record version 1 in agent_versions (immutable snapshot). */
  async insert(values: InsertAgent): Promise<AgentRow> {
    const [row] = await this.db
      .insert(t.agents)
      .values({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description ?? DEFAULT_AGENT_DESCRIPTION,
        provider: values.provider,
        model: values.model,
        systemPrompt: values.systemPrompt,
        outputSchema: (values.outputSchema as object | undefined) ?? null,
        ...(values.strategy !== undefined ? { strategy: values.strategy } : {}),
        ...(values.ciFailOn !== undefined ? { ciFailOn: values.ciFailOn } : {}),
        ...(values.repoIntel !== undefined ? { repoIntel: values.repoIntel } : {}),
        enabled: values.enabled ?? true,
        version: INITIAL_AGENT_VERSION,
        createdBy: values.createdBy ?? null,
      })
      .returning();
    await this.snapshotVersion(row!, INITIAL_AGENT_VERSION);
    return row!;
  }

  /**
   * Update an agent. Any config change bumps the version and snapshots the new
   * config into agent_versions (reproducibility for eval).
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateAgent,
  ): Promise<AgentRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    // A config-affecting change (anything except just toggling enabled) bumps version.
    const configChanged = isConfigChange(existing, patch);
    const nextVersion = configChanged ? existing.version + 1 : existing.version;

    const [row] = await this.db
      .update(t.agents)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.systemPrompt !== undefined ? { systemPrompt: patch.systemPrompt } : {}),
        ...(patch.outputSchema !== undefined
          ? { outputSchema: patch.outputSchema as object }
          : {}),
        ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
        ...(patch.ciFailOn !== undefined ? { ciFailOn: patch.ciFailOn } : {}),
        ...(patch.repoIntel !== undefined ? { repoIntel: patch.repoIntel } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(configChanged ? { version: nextVersion } : {}),
      })
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, id)))
      .returning();

    if (configChanged && row) await this.snapshotVersion(row, nextVersion);
    return row;
  }

  private async snapshotVersion(row: AgentRow, version: number): Promise<void> {
    const skills = await this.skillIdsForAgent(row.id);
    await this.db
      .insert(t.agentVersions)
      .values({
        agentId: row.id,
        version,
        configJson: {
          provider: row.provider,
          model: row.model,
          system_prompt: row.systemPrompt,
          output_schema: row.outputSchema,
          strategy: row.strategy,
          ci_fail_on: row.ciFailOn,
          repo_intel: row.repoIntel,
          skills,
        },
      })
      .onConflictDoNothing();
  }

  // ---- agent_versions (immutable config snapshots) ------------------------

  /** All config snapshots for an agent, newest version first. */
  async listVersions(agentId: string): Promise<AgentVersionRow[]> {
    return this.db
      .select()
      .from(t.agentVersions)
      .where(eq(t.agentVersions.agentId, agentId))
      .orderBy(desc(t.agentVersions.version));
  }

  /** A single config snapshot, or undefined if that version was never recorded. */
  async getVersion(agentId: string, version: number): Promise<AgentVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.agentVersions)
      .where(and(eq(t.agentVersions.agentId, agentId), eq(t.agentVersions.version, version)));
    return row;
  }

  // ---- agent_skills link table (A2 owns the agent side) -------------------

  /** Skills linked to an agent, in `order` ascending (any link state). */
  async linkedSkills(agentId: string): Promise<LinkedSkillRow[]> {
    const rows = await this.db
      .select({ skill: t.skills, order: t.agentSkills.order, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order));
    return rows;
  }

  /**
   * The skills that reach this agent's prompt: link enabled AND skill enabled,
   * in link order. The review executor renders exactly these.
   */
  async effectiveSkills(agentId: string): Promise<LinkedSkillRow[]> {
    return (await this.linkedSkills(agentId)).filter((l) => l.enabled && l.skill.enabled);
  }

  async skillIdsForAgent(agentId: string): Promise<string[]> {
    const links = await this.linkedSkills(agentId);
    return links.map((l) => l.skill.id);
  }

  /** Effective skill count per agent in the workspace (for the agent cards). */
  async effectiveSkillCounts(workspaceId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ agentId: t.agentSkills.agentId, n: count() })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.skills.workspaceId, workspaceId),
          eq(t.skills.enabled, true),
          eq(t.agentSkills.enabled, true),
        ),
      )
      .groupBy(t.agentSkills.agentId);
    return new Map(rows.map((r) => [r.agentId, Number(r.n)]));
  }

  /** How many of `skillIds` belong to the workspace (guards cross-tenant links). */
  async countWorkspaceSkills(workspaceId: string, skillIds: string[]): Promise<number> {
    if (skillIds.length === 0) return 0;
    const [row] = await this.db
      .select({ n: count() })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, skillIds)));
    return Number(row?.n ?? 0);
  }

  /**
   * Replace the full ordered link set of an agent, atomically (order = index).
   * Skills not in the list are unlinked. Used by the editor's Skills tab.
   */
  async setSkills(agentId: string, links: SkillLinkInput[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
      if (links.length === 0) return;
      await tx.insert(t.agentSkills).values(
        links.map((l, i) => ({ agentId, skillId: l.skillId, order: i, enabled: l.enabled })),
      );
    });
  }

  // ---- usage stats ---------------------------------------------------------

  /** Run aggregates per agent over the window (done runs; failed counted apart). */
  async runAggregates(workspaceId: string, windowDays: number, agentId?: string): Promise<AgentRunAggregate[]> {
    const rows = await this.db.execute<{
      agent_id: string;
      runs: number;
      failed: number;
      avg_cost: number | null;
      total_cost: number | null;
      avg_duration: number | null;
    }>(sql`
      SELECT r.agent_id,
             count(*) FILTER (WHERE r.status = 'done')::int AS runs,
             count(*) FILTER (WHERE r.status = 'failed')::int AS failed,
             avg(r.cost_usd) FILTER (WHERE r.status = 'done')::float8 AS avg_cost,
             sum(r.cost_usd) FILTER (WHERE r.status = 'done')::float8 AS total_cost,
             avg(r.duration_ms) FILTER (WHERE r.status = 'done')::float8 AS avg_duration
      FROM ${t.agentRuns} r
      WHERE r.workspace_id = ${workspaceId}
        AND r.agent_id IS NOT NULL
        AND r.ran_at >= now() - make_interval(days => ${windowDays})
        ${agentId ? sql`AND r.agent_id = ${agentId}` : sql``}
      GROUP BY r.agent_id
    `);
    return rows.map((r) => ({
      agentId: r.agent_id,
      runs: Number(r.runs),
      failed: Number(r.failed),
      avgCostUsd: r.avg_cost == null ? null : Number(r.avg_cost),
      totalCostUsd: r.total_cost == null ? null : Number(r.total_cost),
      avgDurationMs: r.avg_duration == null ? null : Number(r.avg_duration),
    }));
  }

  /** Findings of an agent's done runs, per severity, with triage counts. */
  async findingAggregates(
    workspaceId: string,
    windowDays: number,
    agentId?: string,
  ): Promise<AgentFindingAggregate[]> {
    const rows = await this.db.execute<{
      agent_id: string;
      severity: string;
      findings: number;
      accepted: number;
      dismissed: number;
    }>(sql`
      SELECT r.agent_id, f.severity,
             count(*)::int AS findings,
             count(*) FILTER (WHERE f.accepted_at IS NOT NULL)::int AS accepted,
             count(*) FILTER (WHERE f.dismissed_at IS NOT NULL)::int AS dismissed
      FROM ${t.agentRuns} r
      JOIN ${t.reviews} rv ON rv.run_id = r.id
      JOIN ${t.findings} f ON f.review_id = rv.id
      WHERE r.workspace_id = ${workspaceId}
        AND r.agent_id IS NOT NULL
        AND r.status = 'done'
        AND r.ran_at >= now() - make_interval(days => ${windowDays})
        ${agentId ? sql`AND r.agent_id = ${agentId}` : sql``}
      GROUP BY r.agent_id, f.severity
    `);
    return rows.map((r) => ({
      agentId: r.agent_id,
      severity: r.severity,
      findings: Number(r.findings),
      accepted: Number(r.accepted),
      dismissed: Number(r.dismissed),
    }));
  }

  /** The agent's latest done runs (newest first) — the Stats trend line. */
  async recentRuns(
    agentId: string,
    limit: number,
  ): Promise<{ ranAt: Date; score: number | null; findings: number | null }[]> {
    return this.db
      .select({
        ranAt: t.agentRuns.ranAt,
        score: t.agentRuns.score,
        findings: t.agentRuns.findingsCount,
      })
      .from(t.agentRuns)
      .where(and(eq(t.agentRuns.agentId, agentId), eq(t.agentRuns.status, 'done')))
      .orderBy(desc(t.agentRuns.ranAt))
      .limit(limit);
  }
}
