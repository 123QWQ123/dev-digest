import type { AgentSkill, Skill } from "@devdigest/shared";

/** One row of the Skills tab: a workspace skill + its link state for this agent. */
export interface SkillRow {
  skill_id: string;
  name: string;
  description: string;
  type: Skill["type"];
  linked: boolean;
  /** Per-agent switch (false for unlinked rows). */
  enabled: boolean;
  /** Global skill switch. */
  skill_enabled: boolean;
}

/** Linked skills first (in link order), then the rest of the workspace by name. */
export function buildRows(links: AgentSkill[], skills: Skill[]): SkillRow[] {
  const linkedIds = new Set(links.map((l) => l.skill_id));
  const linked: SkillRow[] = [...links]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      skill_id: l.skill_id,
      name: l.name,
      description: l.description,
      type: l.type,
      linked: true,
      enabled: l.enabled,
      skill_enabled: l.skill_enabled,
    }));
  const rest: SkillRow[] = skills
    .filter((sk) => !linkedIds.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((sk) => ({
      skill_id: sk.id,
      name: sk.name,
      description: sk.description,
      type: sk.type,
      linked: false,
      enabled: false,
      skill_enabled: sk.enabled,
    }));
  return [...linked, ...rest];
}

/**
 * Globally disabled skills are hidden from the tab, but their links are kept: the
 * PUT replaces the whole set, so hidden links ride along after the visible ones.
 */
export function splitByGlobalSwitch(rows: SkillRow[]): { shown: SkillRow[]; hiddenLinks: SkillRow[] } {
  return {
    shown: rows.filter((r) => r.skill_enabled),
    hiddenLinks: rows.filter((r) => !r.skill_enabled && r.linked),
  };
}

/** The linked part of the rows, as the agent's ordered link set. */
export function toLinks(rows: SkillRow[]): AgentSkill[] {
  return rows
    .filter((r) => r.linked)
    .map((r, order) => ({
      skill_id: r.skill_id,
      name: r.name,
      description: r.description,
      type: r.type,
      order,
      enabled: r.enabled,
      skill_enabled: r.skill_enabled,
    }));
}

/**
 * Tick/untick a skill. Ticking an unlinked skill attaches it at the END of the
 * linked block (enabled). Unticking keeps the link — and its position — but
 * disables it for this agent.
 */
export function toggleRow(rows: SkillRow[], skillId: string): SkillRow[] {
  const row = rows.find((r) => r.skill_id === skillId);
  if (!row) return rows;
  if (row.linked) {
    return rows.map((r) => (r.skill_id === skillId ? { ...r, enabled: !r.enabled } : r));
  }
  const linked = rows.filter((r) => r.linked);
  const rest = rows.filter((r) => !r.linked && r.skill_id !== skillId);
  return [...linked, { ...row, linked: true, enabled: true }, ...rest];
}

/** Move a linked skill to another index of the linked block (clamped). */
export function moveRow(rows: SkillRow[], skillId: string, toIndex: number): SkillRow[] {
  const linked = rows.filter((r) => r.linked);
  const from = linked.findIndex((r) => r.skill_id === skillId);
  if (from < 0) return rows;
  const to = Math.max(0, Math.min(linked.length - 1, toIndex));
  if (to === from) return rows;
  const next = [...linked];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return [...next, ...rows.filter((r) => !r.linked)];
}

/** Skills that actually reach the prompt (link enabled AND skill enabled). */
export function effectiveCount(rows: SkillRow[]): number {
  return rows.filter((r) => r.linked && r.enabled && r.skill_enabled).length;
}

export function matchesFilter(row: SkillRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.name.toLowerCase().includes(needle) ||
    row.description.toLowerCase().includes(needle) ||
    row.type.includes(needle)
  );
}
