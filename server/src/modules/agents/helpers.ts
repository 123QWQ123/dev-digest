import type {
  Agent,
  AgentSkill,
  AgentStats,
  AgentVersion,
  CiFailOn,
  Provider,
  ReviewStrategy,
  SkillType,
} from '@devdigest/shared';
import { AgentVersionConfig } from '@devdigest/shared';
import type {
  AgentFindingAggregate,
  AgentRow,
  AgentRunAggregate,
  AgentVersionRow,
  LinkedSkillRow,
} from './repository.js';

/**
 * Pure helpers for the agents module — DB row ⇄ DTO mapping and the
 * config-version-bump rule. No I/O; behaviour-identical to the previous inline
 * implementations.
 */

/** Map a persisted agent row to the public `Agent` DTO. */
export function toAgentDto(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    provider: row.provider as Provider,
    model: row.model,
    system_prompt: row.systemPrompt,
    output_schema: row.outputSchema ?? null,
    enabled: row.enabled,
    version: row.version,
    strategy: row.strategy as ReviewStrategy,
    ci_fail_on: row.ciFailOn as CiFailOn,
    repo_intel: row.repoIntel,
  };
}

/**
 * Map a persisted `agent_versions` row to the public `AgentVersion` DTO. The
 * stored `config_json` is untyped jsonb (a snapshot from an older config shape
 * could drift), so it is parsed through `AgentVersionConfig` — a malformed
 * snapshot throws here rather than leaking an unvalidated blob to the client.
 */
export function toAgentVersionDto(row: AgentVersionRow): AgentVersion {
  return {
    agent_id: row.agentId,
    version: row.version,
    config: AgentVersionConfig.parse(row.configJson),
    created_at: row.createdAt.toISOString(),
  };
}

/** Map an agent_skills link (joined with its skill) to the editor's `AgentSkill`. */
export function toAgentSkillDto(link: LinkedSkillRow): AgentSkill {
  return {
    skill_id: link.skill.id,
    name: link.skill.name,
    description: link.skill.description,
    type: link.skill.type as SkillType,
    order: link.order,
    enabled: link.enabled,
    skill_enabled: link.skill.enabled,
  };
}

/** Fields whose change bumps the agent's config version (anything but `enabled`). */
export interface ConfigChangePatch {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  systemPrompt?: string;
  outputSchema?: unknown;
  strategy?: ReviewStrategy;
  ciFailOn?: CiFailOn;
  repoIntel?: boolean;
}

/**
 * True when a patch changes config (vs. just toggling `enabled`) relative to the
 * existing row — a config change bumps the version and snapshots agent_versions.
 */
export function isConfigChange(
  existing: Pick<
    AgentRow,
    | 'name'
    | 'description'
    | 'provider'
    | 'model'
    | 'systemPrompt'
    | 'strategy'
    | 'ciFailOn'
    | 'repoIntel'
  >,
  patch: ConfigChangePatch,
): boolean {
  return (
    (patch.name !== undefined && patch.name !== existing.name) ||
    (patch.description !== undefined && patch.description !== existing.description) ||
    (patch.provider !== undefined && patch.provider !== existing.provider) ||
    (patch.model !== undefined && patch.model !== existing.model) ||
    (patch.systemPrompt !== undefined && patch.systemPrompt !== existing.systemPrompt) ||
    (patch.strategy !== undefined && patch.strategy !== existing.strategy) ||
    (patch.ciFailOn !== undefined && patch.ciFailOn !== existing.ciFailOn) ||
    (patch.repoIntel !== undefined && patch.repoIntel !== existing.repoIntel) ||
    patch.outputSchema !== undefined
  );
}

// ---- usage stats ------------------------------------------------------------

function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

function sumFindings(rows: AgentFindingAggregate[]) {
  const bySeverity = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  let total = 0;
  let accepted = 0;
  let dismissed = 0;
  for (const r of rows) {
    total += r.findings;
    accepted += r.accepted;
    dismissed += r.dismissed;
    if (r.severity in bySeverity) bySeverity[r.severity as keyof typeof bySeverity] += r.findings;
  }
  return { total, accepted, dismissed, bySeverity };
}

/** Card-sized summary per agent (runs, accept rate, avg cost). */
export function agentCardStats(
  runs: AgentRunAggregate[],
  findings: AgentFindingAggregate[],
): Map<string, NonNullable<Agent['stats']>> {
  const out = new Map<string, NonNullable<Agent['stats']>>();
  for (const r of runs) {
    const f = sumFindings(findings.filter((x) => x.agentId === r.agentId));
    out.set(r.agentId, {
      runs: r.runs,
      accept_rate: ratio(f.accepted, f.accepted + f.dismissed),
      avg_cost_usd: r.avgCostUsd,
    });
  }
  return out;
}

/** The M7 `AgentStats` contract, computed over the stats window. */
export function toAgentStats(
  agent: { id: string; name: string },
  runs: AgentRunAggregate | undefined,
  findings: AgentFindingAggregate[],
  recent: { ranAt: Date; score: number | null }[],
): AgentStats {
  const f = sumFindings(findings);
  const n = runs?.runs ?? 0;
  const acted = f.accepted + f.dismissed;
  return {
    agent_id: agent.id,
    agent_name: agent.name,
    runs: n,
    findings_total: f.total,
    accepted: f.accepted,
    dismissed: f.dismissed,
    pending: f.total - acted,
    accept_rate: ratio(f.accepted, acted),
    dismiss_rate: ratio(f.dismissed, acted),
    avg_findings_per_run: ratio(f.total, n),
    total_cost_usd: runs?.totalCostUsd ?? null,
    avg_cost_usd: runs?.avgCostUsd ?? null,
    avg_latency_ms: runs?.avgDurationMs ?? null,
    findings_by_severity: f.bySeverity,
    trend: [...recent]
      .reverse()
      .filter((r) => r.score != null)
      .map((r) => ({ label: r.ranAt.toISOString().slice(0, 10), value: r.score as number })),
  };
}
