import type {
  CategoryCount,
  Skill,
  SkillSource,
  SkillStats,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import type {
  SkillFindingUsage,
  SkillRow,
  SkillRunUsage,
  SkillVersionRow,
} from './repository.js';

/** Pure helpers for the skills module — DB row ⇄ DTO mapping and the version-bump rule. */

export function toSkillDto(row: SkillRow & { agentCount?: number }): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    ...(row.agentCount !== undefined ? { agent_count: row.agentCount } : {}),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    name: row.name,
    description: row.description,
    type: (row.type as SkillType | null) ?? null,
    body: row.body,
    note: row.note,
    created_at: row.createdAt.toISOString(),
  };
}

/** A content change (name/description/type/body) creates a new version; `enabled` alone does not. */
export function isContentChange(
  existing: Pick<SkillRow, 'name' | 'description' | 'type' | 'body'>,
  patch: { name?: string; description?: string; type?: string; body?: string },
): boolean {
  return (
    (patch.name !== undefined && patch.name !== existing.name) ||
    (patch.description !== undefined && patch.description !== existing.description) ||
    (patch.type !== undefined && patch.type !== existing.type) ||
    (patch.body !== undefined && patch.body !== existing.body)
  );
}

// ---- usage stats ------------------------------------------------------------

/** num/den, or null when there is nothing to divide by. */
export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

/** Sum findings per category (desc by count, then name) plus triage totals. */
export function summarizeFindings(rows: SkillFindingUsage[]): {
  findings: number;
  accepted: number;
  dismissed: number;
  byCategory: CategoryCount[];
} {
  const byCat = new Map<string, number>();
  let findings = 0;
  let accepted = 0;
  let dismissed = 0;
  for (const r of rows) {
    findings += r.findings;
    accepted += r.accepted;
    dismissed += r.dismissed;
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.findings);
  }
  const byCategory = [...byCat]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  return { findings, accepted, dismissed, byCategory };
}

/** Card-sized summary for every skill in the list. */
export function cardStats(
  runs: SkillRunUsage[],
  findings: SkillFindingUsage[],
): Map<string, NonNullable<Skill['stats']>> {
  const out = new Map<string, NonNullable<Skill['stats']>>();
  const runBy = new Map(runs.map((r) => [r.skillId, r]));
  const findBy = new Map<string, SkillFindingUsage[]>();
  for (const f of findings) findBy.set(f.skillId, [...(findBy.get(f.skillId) ?? []), f]);
  for (const id of new Set([...runBy.keys(), ...findBy.keys()])) {
    const r = runBy.get(id);
    const f = summarizeFindings(findBy.get(id) ?? []);
    out.set(id, {
      pull_rate: ratio(r?.usedRuns ?? 0, r?.runs ?? 0),
      accept_rate: ratio(f.accepted, f.accepted + f.dismissed),
    });
  }
  return out;
}

export function toSkillStats(
  skillId: string,
  windowDays: number,
  usedBy: SkillStats['used_by'],
  runs: SkillRunUsage | undefined,
  findings: SkillFindingUsage[],
): SkillStats {
  const f = summarizeFindings(findings);
  return {
    skill_id: skillId,
    window_days: windowDays,
    used_by: usedBy,
    agent_runs: runs?.runs ?? 0,
    runs_with_skill: runs?.usedRuns ?? 0,
    pull_rate: ratio(runs?.usedRuns ?? 0, runs?.runs ?? 0),
    accept_rate: ratio(f.accepted, f.accepted + f.dismissed),
    findings: f.findings,
    findings_by_category: f.byCategory,
  };
}
