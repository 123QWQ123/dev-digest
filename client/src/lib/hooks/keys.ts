/* keys.ts — the ONE place React Query keys are defined. Hooks, invalidations
   and cache updates all go through these factories, so a key can't drift
   between the query that fills the cache and the mutation that clears it. */

/** Hooks are often called before an id is known (`enabled: !!id`) — keys carry it as-is. */
type Id = string | number | null | undefined;

export const queryKeys = {
  settings: () => ["settings"] as const,
  secretsStatus: () => ["secrets-status"] as const,
  repos: () => ["repos"] as const,
  pulls: (repoId: Id) => ["pulls", repoId] as const,
  pull: (prId: Id) => ["pull", prId] as const,
  context: (repoId: Id) => ["context", repoId] as const,
  agents: () => ["agents"] as const,
  agent: (id: Id) => ["agent", id] as const,
  agentSkills: (agentId: Id) => ["agent-skills", agentId] as const,
  /** Prefix matching every agent's link set (a skill edit changes all of them). */
  agentSkillsAll: () => ["agent-skills"] as const,
  skills: () => ["skills"] as const,
  skill: (id: Id) => ["skill", id] as const,
  skillVersions: (id: Id) => ["skill-versions", id] as const,
  skillStats: (id: Id) => ["skill-stats", id] as const,
  /** Prefix matching every skill's stats (a triaged finding moves them all). */
  skillStatsAll: () => ["skill-stats"] as const,
  agentStats: (id: Id) => ["agent-stats", id] as const,
  agentStatsAll: () => ["agent-stats"] as const,
  tokenCount: (text: string) => ["token-count", text] as const,
  providerModels: (provider: Id) => ["provider-models", provider] as const,
  /** Prefix matching every provider's model list (for invalidation). */
  providerModelsAll: () => ["provider-models"] as const,
  repoIntelState: (repoId: Id) => ["repo-intel-state", repoId] as const,
  conventions: (repoId: Id) => ["conventions", repoId] as const,
  prActiveRuns: (prId: Id) => ["pr-active-runs", prId] as const,
  prRuns: (prId: Id) => ["pr-runs", prId] as const,
  reviews: (prId: Id) => ["reviews", prId] as const,
  prComments: (prId: Id) => ["pr-comments", prId] as const,
  runTrace: (runId: Id) => ["run-trace", runId] as const,
};
