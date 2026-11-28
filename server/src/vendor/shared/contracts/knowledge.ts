import { z } from 'zod';

/**
 * Conformance, Onboarding, Eval, Memory, Conventions, Skills,
 * Agents and their DTOs.
 */

// ---- Conformance ----
export const ConformanceStatus = z.enum(['implemented', 'missing', 'out_of_scope']);
export type ConformanceStatus = z.infer<typeof ConformanceStatus>;

export const ConformanceItem = z.object({
  requirement: z.string(),
  status: ConformanceStatus,
  evidence_file: z.string().nullish(),
  notes: z.string().nullish(),
});
export type ConformanceItem = z.infer<typeof ConformanceItem>;

export const Conformance = z.object({
  spec_id: z.string(),
  spec_title: z.string(),
  items: z.array(ConformanceItem),
  completeness_pct: z.number().min(0).max(100),
});
export type Conformance = z.infer<typeof Conformance>;

// ---- Onboarding ----
export const OnboardingLink = z.object({
  label: z.string(),
  path: z.string(),
});
export type OnboardingLink = z.infer<typeof OnboardingLink>;

export const OnboardingSection = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(), // markdown
  diagram: z.string().nullish(), // mermaid
  links: z.array(OnboardingLink),
});
export type OnboardingSection = z.infer<typeof OnboardingSection>;

export const Onboarding = z.object({
  sections: z.array(OnboardingSection),
});
export type Onboarding = z.infer<typeof Onboarding>;

// ---- Eval ----
export const EvalPerTrace = z.object({
  name: z.string(),
  pass: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
});
export type EvalPerTrace = z.infer<typeof EvalPerTrace>;

export const EvalRun = z.object({
  recall: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  citation_accuracy: z.number().min(0).max(1),
  traces_passed: z.number().int(),
  traces_total: z.number().int(),
  duration_ms: z.number().int(),
  cost_usd: z.number().nullable(),
  per_trace: z.array(EvalPerTrace),
});
export type EvalRun = z.infer<typeof EvalRun>;

export const EvalOwnerKind = z.enum(['skill', 'agent']);
export type EvalOwnerKind = z.infer<typeof EvalOwnerKind>;

export const EvalCase = z.object({
  id: z.string(),
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  name: z.string(),
  input_diff: z.string(),
  input_files: z.unknown(),
  input_meta: z.unknown(),
  expected_output: z.unknown(),
  notes: z.string().nullish(),
});
export type EvalCase = z.infer<typeof EvalCase>;

// ---- Memory ----
export const MemoryScope = z.enum(['repo', 'global', 'team']);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryKind = z.enum([
  'decision',
  'convention',
  'preference',
  'fact',
  'learning',
]);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const MemorySource = z.object({
  pr: z.number().int().nullish(),
  context: z.string(),
});
export type MemorySource = z.infer<typeof MemorySource>;

export const MemoryItem = z.object({
  content: z.string(),
  scope: MemoryScope,
  kind: MemoryKind,
  confidence: z.number().min(0).max(1),
  sources: z.array(MemorySource),
});
export type MemoryItem = z.infer<typeof MemoryItem>;

// ---- Skills ----
export const SkillType = z.enum(['rubric', 'convention', 'security', 'custom']);
export type SkillType = z.infer<typeof SkillType>;

// 'imported' = uploaded .md/.zip via the import preview (M2); treated as untrusted in the UI.
export const SkillSource = z.enum(['manual', 'imported', 'imported_url', 'extracted', 'community']);
export type SkillSource = z.infer<typeof SkillSource>;

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  source: SkillSource,
  body: z.string(),
  enabled: z.boolean(),
  version: z.number().int(),
  evidence_files: z.array(z.string()).nullish(),
  /** Number of agents linking this skill (any link state). Absent on nested payloads. */
  agent_count: z.number().int().optional(),
  updated_at: z.string().optional(),
  /** 30-day usage summary for the list card (absent on nested payloads). */
  stats: z
    .object({
      /** Share (0..1) of linked agents' runs that rendered this skill; null = no runs. */
      pull_rate: z.number().nullable(),
      /** accepted / (accepted + dismissed) for findings of runs that used it; null = none triaged. */
      accept_rate: z.number().nullable(),
    })
    .optional(),
});
export type Skill = z.infer<typeof Skill>;

/** Window every usage stat is computed over. */
export const STATS_WINDOW_DAYS = 30;

export const CategoryCount = z.object({ category: z.string(), count: z.number().int() });
export type CategoryCount = z.infer<typeof CategoryCount>;

/**
 * Skill Stats tab (M2). Findings are attributed to a skill when the run that produced
 * them had the skill in its prompt (`run_skills`) — the model does not tag findings
 * per skill, so this is co-occurrence, not causation.
 */
export const SkillStats = z.object({
  skill_id: z.string(),
  window_days: z.number().int(),
  used_by: z.array(z.object({ id: z.string(), name: z.string(), enabled: z.boolean() })),
  /** Completed runs (window) of agents that currently link the skill. */
  agent_runs: z.number().int(),
  /** Of those, runs that rendered the skill into the prompt. */
  runs_with_skill: z.number().int(),
  pull_rate: z.number().nullable(),
  accept_rate: z.number().nullable(),
  findings: z.number().int(),
  findings_by_category: z.array(CategoryCount),
});
export type SkillStats = z.infer<typeof SkillStats>;

/** Limits shared by the editor and the API. */
export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 300;
export const SKILL_BODY_MAX = 20_000;

/** Skill name: kebab-case slug (it is shown as a `### heading` in the prompt). */
export const SkillName = z
  .string()
  .min(1)
  .max(SKILL_NAME_MAX)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes');

/** Create payload. `source` defaults to manual; `imported` comes from the import preview. */
export const CreateSkillInput = z.object({
  name: SkillName,
  description: z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX),
  type: SkillType,
  body: z.string().trim().min(1).max(SKILL_BODY_MAX),
  source: z.enum(['manual', 'imported']).optional(),
  enabled: z.boolean().optional(),
  note: z.string().max(200).optional(),
});
export type CreateSkillInput = z.infer<typeof CreateSkillInput>;

/** Update payload. A content change bumps the version; `enabled` alone does not. */
export const UpdateSkillInput = CreateSkillInput.omit({ source: true }).partial();
export type UpdateSkillInput = z.infer<typeof UpdateSkillInput>;

/** An immutable snapshot from `skill_versions`. */
export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/** Largest accepted import file (bytes) and its base64 length. */
export const SKILL_IMPORT_MAX_BYTES = 1_048_576;
export const SKILL_IMPORT_MAX_BASE64_CHARS = Math.ceil(SKILL_IMPORT_MAX_BYTES / 3) * 4;

/** `POST /skills/import/preview` request: the raw file, base64-encoded. */
export const SkillImportRequest = z.object({
  filename: z.string().min(1).max(255),
  // .base64() rejects non-base64 text (Buffer.from would silently drop it);
  // .max() states the 1 MB upload limit in the contract, not only the bodyLimit.
  content_base64: z.string().min(1).max(SKILL_IMPORT_MAX_BASE64_CHARS).base64(),
});
export type SkillImportRequest = z.infer<typeof SkillImportRequest>;

/** The extracted skill core. Nothing is persisted until the user saves it. */
export const SkillImportPreview = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  /** Path of the markdown entry the skill was read from. */
  source_file: z.string(),
  /** Archive entries that were NOT read (scripts, binaries, other files) — never executed. */
  ignored_files: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;

export const CommunitySkill = z.object({
  name: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  lang: z.string(),
  desc: z.string(),
});
export type CommunitySkill = z.infer<typeof CommunitySkill>;

// ---- Conventions ----
/** 1-based inclusive line range of a convention's evidence snippet. */
export const EvidenceLines = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
});
export type EvidenceLines = z.infer<typeof EvidenceLines>;

export const ConventionCandidate = z.object({
  id: z.string(),
  rule: z.string(),
  evidence_path: z.string(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  accepted: z.boolean(),
  /** Where the snippet was found in `evidence_path` (null for legacy rows). */
  evidence_lines: EvidenceLines.nullish(),
  /** When the scan that produced this candidate ran. */
  created_at: z.string().nullish(),
});
export type ConventionCandidate = z.infer<typeof ConventionCandidate>;

/** Limits shared by the extractor and the editor. */
export const CONVENTION_RULE_MAX = 500;
export const CONVENTION_SNIPPET_MAX = 1_500;
export const CONVENTION_MAX_CANDIDATES = 15;

/** Structured LLM output of the extractor (schemaName `ConventionExtraction`). */
export const ConventionExtraction = z.object({
  conventions: z
    .array(
      z.object({
        rule: z.string(),
        evidence_path: z.string(),
        evidence_snippet: z.string(),
        confidence: z.number(),
      }),
    )
    .max(CONVENTION_MAX_CANDIDATES),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;

/** `GET /repos/:id/conventions`. */
export const ConventionList = z.object({
  items: z.array(ConventionCandidate),
  /** Newest scan time across the repo's candidates; null when never scanned. */
  last_scan_at: z.string().nullable(),
});
export type ConventionList = z.infer<typeof ConventionList>;

/** `POST /repos/:id/conventions/extract`. Cost is reported, not stored. */
export const ExtractConventionsResult = ConventionList.extend({
  /** Files sent to the model (configs + ranked samples). */
  sampled_files: z.number().int(),
  /** Candidates kept after evidence verification / dropped by it. */
  kept: z.number().int(),
  dropped: z.number().int(),
  model: z.string(),
  tokens_in: z.number().int().nullable(),
  tokens_out: z.number().int().nullable(),
  /** null = unknown (unpriced model); 0 = known free. */
  cost_usd: z.number().nullable(),
});
export type ExtractConventionsResult = z.infer<typeof ExtractConventionsResult>;

/** `PATCH /conventions/:id`: edit the rule text and/or accept/reject. */
export const UpdateConventionInput = z
  .object({
    rule: z.string().trim().min(1).max(CONVENTION_RULE_MAX).optional(),
    accepted: z.boolean().optional(),
  })
  .refine((v) => v.rule !== undefined || v.accepted !== undefined, {
    message: 'Provide rule and/or accepted',
  });
export type UpdateConventionInput = z.infer<typeof UpdateConventionInput>;

/**
 * `POST /repos/:id/conventions/skill`: save the accepted candidates as one skill.
 * The server forces `type: convention`, `source: extracted` and `evidence_files`.
 */
export const CreateConventionSkillInput = z.object({
  name: SkillName,
  description: z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX),
  body: z.string().trim().min(1).max(SKILL_BODY_MAX),
  enabled: z.boolean().optional(),
});
export type CreateConventionSkillInput = z.infer<typeof CreateConventionSkillInput>;

// ---- Agents ----
// 'openrouter' routes through the OpenAI-compatible API (OpenAIProvider with a
// custom baseURL) — used by the CI runner for cheap models (DeepSeek/GLM/MiniMax).
export const Provider = z.enum(['openai', 'anthropic', 'openrouter']);
export type Provider = z.infer<typeof Provider>;

// Review execution strategy (matches @devdigest/reviewer-core's ReviewStrategy):
//  - single-pass: send the WHOLE diff in ONE model call (default)
//  - map-reduce:  one model call PER changed file (for very large diffs)
//  - auto:        single-pass, switching to map-reduce when the diff is large
export const ReviewStrategy = z.enum(['single-pass', 'map-reduce', 'auto']);
export type ReviewStrategy = z.infer<typeof ReviewStrategy>;

// CI gate policy — when a review should BLOCK (REQUEST_CHANGES + fail the check)
// vs just comment. Deterministic from finding severities, NOT the model's verdict:
//  - never:    never block, always comment (advisory only)
//  - critical: block iff >=1 CRITICAL finding (default)
//  - warning:  block iff >=1 WARNING or CRITICAL finding
//  - any:      block iff >=1 finding of any severity
export const CiFailOn = z.enum(['never', 'critical', 'warning', 'any']);
export type CiFailOn = z.infer<typeof CiFailOn>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  enabled: z.boolean(),
  version: z.number().int(),
  strategy: ReviewStrategy.default('single-pass'),
  ci_fail_on: CiFailOn.default('critical'),
  // Inject repo-intel context (repo skeleton + callers + rank note) into this
  // agent's review prompt. Default on; gated again by the global flag.
  repo_intel: z.boolean().default(true),
  /** Skills that reach this agent's prompt (link enabled AND skill enabled). */
  skill_count: z.number().int().optional(),
  /** 30-day summary for the list card (absent on nested payloads). */
  stats: z
    .object({
      runs: z.number().int(),
      accept_rate: z.number().nullable(),
      avg_cost_usd: z.number().nullable(),
    })
    .optional(),
});
export type Agent = z.infer<typeof Agent>;

export const AgentSkillLink = z.object({
  agent_id: z.string(),
  skill_id: z.string(),
  order: z.number().int(),
});
export type AgentSkillLink = z.infer<typeof AgentSkillLink>;

/** A skill linked to an agent, as shown in the agent editor's Skills tab. */
export const AgentSkill = z.object({
  skill_id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  order: z.number().int(),
  /** Per-agent switch. */
  enabled: z.boolean(),
  /** Global skill switch; a disabled skill never reaches any prompt. */
  skill_enabled: z.boolean(),
});
export type AgentSkill = z.infer<typeof AgentSkill>;

/** `PUT /agents/:id/skills` — the full ordered link set (array order = prompt order). */
export const SetAgentSkillsInput = z.object({
  items: z
    .array(z.object({ skill_id: z.string().uuid(), enabled: z.boolean() }))
    .max(100)
    .refine((xs) => new Set(xs.map((x) => x.skill_id)).size === xs.length, {
      message: 'Duplicate skill_id',
    }),
});
export type SetAgentSkillsInput = z.infer<typeof SetAgentSkillsInput>;

// The immutable config snapshot captured in `agent_versions` whenever an agent's
// config changes (everything but `enabled`). Mirrors the shape written by the
// agents repository — provider/model/prompt/output_schema/strategy/gate/repo_intel
// plus the ordered skill ids linked at snapshot time. Used for reproducibility
// (eval replays a past version) and for surfacing an agent's edit history.
export const AgentVersionConfig = z.object({
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  strategy: ReviewStrategy,
  ci_fail_on: CiFailOn,
  repo_intel: z.boolean(),
  skills: z.array(z.string()),
});
export type AgentVersionConfig = z.infer<typeof AgentVersionConfig>;

export const AgentVersion = z.object({
  agent_id: z.string(),
  version: z.number().int(),
  config: AgentVersionConfig,
  created_at: z.string(),
});
export type AgentVersion = z.infer<typeof AgentVersion>;
