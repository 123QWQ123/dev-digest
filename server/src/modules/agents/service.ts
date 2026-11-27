import type { Container } from '../../platform/container.js';
import type {
  Agent,
  AgentSkill,
  AgentStats,
  AgentVersion,
  CiFailOn,
  ModelInfo,
  Provider,
  ReviewStrategy,
} from '@devdigest/shared';
import type { AgentsRepository } from './repository.js';
import { STATS_WINDOW_DAYS } from '@devdigest/shared';
import {
  agentCardStats,
  toAgentDto,
  toAgentSkillDto,
  toAgentStats,
  toAgentVersionDto,
} from './helpers.js';
import { ValidationError } from '../../platform/errors.js';
import { STATS_TREND_RUNS } from './constants.js';

/** The container members this code actually uses (explicit deps, not a service locator). */
export type AgentsServiceDeps = Pick<Container, 'llm'>;

/**
 * A2 — agents service. Business logic for the Agents tab + Agent Editor.
 * Provider/model selection uses the LLM adapter's dynamic model list.
 *
 * An Agent = provider + model + system_prompt + linked skills + output_schema +
 * enabled. Config changes are versioned via `agent_versions` (repository).
 */

// Re-exported for backwards compatibility; implementation lives in ./helpers.
export { toAgentDto } from './helpers.js';

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  ci_fail_on?: CiFailOn;
  repo_intel?: boolean;
  enabled?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  system_prompt?: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  ci_fail_on?: CiFailOn;
  repo_intel?: boolean;
  enabled?: boolean;
}

export class AgentsService {
  private repo: AgentsRepository;

  constructor(private container: AgentsServiceDeps, repo: AgentsRepository) {
    this.repo = repo;
  }

  async list(workspaceId: string): Promise<Agent[]> {
    const [rows, counts, runs, findings] = await Promise.all([
      this.repo.list(workspaceId),
      this.repo.effectiveSkillCounts(workspaceId),
      this.repo.runAggregates(workspaceId, STATS_WINDOW_DAYS),
      this.repo.findingAggregates(workspaceId, STATS_WINDOW_DAYS),
    ]);
    const stats = agentCardStats(runs, findings);
    const empty = { runs: 0, accept_rate: null, avg_cost_usd: null };
    return rows.map((r) => ({
      ...toAgentDto(r),
      skill_count: counts.get(r.id) ?? 0,
      stats: stats.get(r.id) ?? empty,
    }));
  }

  /** Stats tab (M7 contract): aggregates over the last STATS_WINDOW_DAYS. undefined → 404. */
  async stats(workspaceId: string, agentId: string): Promise<AgentStats | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const [runs, findings, recent] = await Promise.all([
      this.repo.runAggregates(workspaceId, STATS_WINDOW_DAYS, agentId),
      this.repo.findingAggregates(workspaceId, STATS_WINDOW_DAYS, agentId),
      this.repo.recentRuns(agentId, STATS_TREND_RUNS),
    ]);
    return toAgentStats(agent, runs[0], findings, recent);
  }

  async get(workspaceId: string, id: string): Promise<Agent | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const effective = await this.repo.effectiveSkills(id);
    return { ...toAgentDto(row), skill_count: effective.length };
  }

  /** Delete an agent (and its versions/skill-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async create(workspaceId: string, input: CreateAgentInput, userId?: string): Promise<Agent> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      provider: input.provider,
      model: input.model,
      systemPrompt: input.system_prompt,
      outputSchema: input.output_schema,
      ...(input.strategy !== undefined ? { strategy: input.strategy } : {}),
      ...(input.ci_fail_on !== undefined ? { ciFailOn: input.ci_fail_on } : {}),
      ...(input.repo_intel !== undefined ? { repoIntel: input.repo_intel } : {}),
      enabled: input.enabled,
      createdBy: userId ?? null,
    });
    return toAgentDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateAgentInput,
  ): Promise<Agent | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.system_prompt !== undefined ? { systemPrompt: patch.system_prompt } : {}),
      ...(patch.output_schema !== undefined ? { outputSchema: patch.output_schema } : {}),
      ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
      ...(patch.ci_fail_on !== undefined ? { ciFailOn: patch.ci_fail_on } : {}),
      ...(patch.repo_intel !== undefined ? { repoIntel: patch.repo_intel } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return row ? toAgentDto(row) : undefined;
  }

  /**
   * Config history for an agent, newest version first. Workspace-scoped: returns
   * undefined when the agent isn't in this workspace (the route maps that to 404)
   * so version snapshots can't be read across tenants.
   */
  async listVersions(workspaceId: string, agentId: string): Promise<AgentVersion[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const rows = await this.repo.listVersions(agentId);
    return rows.map(toAgentVersionDto);
  }

  /**
   * A single config snapshot for an agent. Returns undefined when the agent isn't
   * in this workspace OR that version was never recorded (route → 404).
   */
  async getVersion(
    workspaceId: string,
    agentId: string,
    version: number,
  ): Promise<AgentVersion | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const row = await this.repo.getVersion(agentId, version);
    return row ? toAgentVersionDto(row) : undefined;
  }

  /** Skills linked to an agent, ordered, with per-agent + global switches. */
  async listSkills(workspaceId: string, agentId: string): Promise<AgentSkill[] | undefined> {
    if (!(await this.repo.getById(workspaceId, agentId))) return undefined;
    return (await this.repo.linkedSkills(agentId)).map(toAgentSkillDto);
  }

  /**
   * Replace the agent's ordered link set (array order = prompt order). Every
   * skill must belong to the workspace — otherwise 422, nothing is written.
   */
  async setSkills(
    workspaceId: string,
    agentId: string,
    items: { skill_id: string; enabled: boolean }[],
  ): Promise<AgentSkill[] | undefined> {
    if (!(await this.repo.getById(workspaceId, agentId))) return undefined;
    const ids = items.map((i) => i.skill_id);
    if ((await this.repo.countWorkspaceSkills(workspaceId, ids)) !== ids.length) {
      throw new ValidationError('Unknown skill_id for this workspace');
    }
    await this.repo.setSkills(
      agentId,
      items.map((i) => ({ skillId: i.skill_id, enabled: i.enabled })),
    );
    return this.listSkills(workspaceId, agentId);
  }

  /**
   * Dynamic model list from the provider adapter's /models. Degrades gracefully
   * to [] if the provider key is not configured (the editor still renders).
   */
  async listModels(provider: Provider): Promise<ModelInfo[]> {
    try {
      const llm = await this.container.llm(provider);
      return await llm.listModels();
    } catch {
      return [];
    }
  }
}
