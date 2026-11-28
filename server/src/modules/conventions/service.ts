import {
  CONVENTION_MAX_CANDIDATES,
  CONVENTION_RULE_MAX,
  ConventionExtraction,
  type ConventionCandidate,
  type ConventionList,
  type CreateConventionSkillInput,
  type ExtractConventionsResult,
  type GitClient,
  type LLMProvider,
  type Provider,
  type Skill,
  type StructuredRequest,
  type StructuredResult,
  type UpdateConventionInput,
} from '@devdigest/shared';
import { AppError, ExternalServiceError, NotFoundError, ValidationError } from '../../platform/errors.js';
import { renderPrompt } from '../../platform/prompts.js';
import type { RepoIntel } from '../repo-intel/types.js';
import type { SkillsService } from '../skills/index.js';
import type { FeatureModelResolver } from '../settings/index.js';
import {
  CONFIG_FILES,
  EXTRACTION_SCHEMA_NAME,
  EXTRACTION_TEMPERATURE,
  EXTRACTION_TIMEOUT_MS,
  MAX_FILE_CHARS,
  SAMPLE_FILE_COUNT,
} from './constants.js';
import { normalizeRule, verifyCandidates } from './domain/verify.js';
import { buildUserMessage, capContent, lastScanAt, toConventionDto } from './helpers.js';
import type { ConventionsRepository, RepoRow } from './repository.js';

export interface ConventionsLogger {
  warn(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
}

export interface ConventionsDeps {
  llm: (id: Provider) => Promise<LLMProvider>;
  git: () => GitClient;
  repoIntel: () => RepoIntel;
  resolveModel: FeatureModelResolver;
  skills: Pick<SkillsService, 'createExtracted'>;
  /** Repo ids with an extraction in progress (shared across requests). */
  inFlight: Set<string>;
  log: ConventionsLogger;
}

/**
 * M2 — Conventions Extractor. Samples the repo by code (configs + top-ranked
 * files), asks the `conventions` feature model for candidates in ONE structured
 * call, grounds each candidate against the files it was shown, and stores the
 * survivors. Accepted candidates are merged into one `convention` skill.
 */
export class ConventionsService {
  constructor(
    private deps: ConventionsDeps,
    private repo: ConventionsRepository,
  ) {}

  async list(workspaceId: string, repoId: string): Promise<ConventionList> {
    await this.requireRepo(workspaceId, repoId);
    const rows = await this.repo.list(workspaceId, repoId);
    return { items: rows.map(toConventionDto), last_scan_at: lastScanAt(rows) };
  }

  async extract(workspaceId: string, repoId: string): Promise<ExtractConventionsResult> {
    const repo = await this.requireRepo(workspaceId, repoId);
    if (!repo.clonePath) {
      throw new AppError('repo_not_cloned', 'The repo is not cloned yet — wait for the clone to finish', 422);
    }
    const { inFlight } = this.deps;
    if (inFlight.has(repoId)) {
      throw new AppError('extraction_in_progress', 'An extraction is already running for this repo', 409);
    }
    inFlight.add(repoId);
    try {
      return await this.runExtraction(workspaceId, repo);
    } finally {
      inFlight.delete(repoId);
    }
  }

  private async runExtraction(workspaceId: string, repo: RepoRow): Promise<ExtractConventionsResult> {
    const samplePaths = await this.deps.repoIntel().getConventionSamples(repo.id, SAMPLE_FILE_COUNT);
    if (samplePaths.length === 0) {
      throw new AppError(
        'index_not_ready',
        'The repo index is not ready — wait for indexing to finish (or re-sync) and try again',
        422,
      );
    }
    const ref = { owner: repo.owner, name: repo.name };
    const configs = await this.readFiles(ref, CONFIG_FILES);
    const samples = await this.readFiles(ref, samplePaths);
    if (samples.size === 0) {
      throw new AppError('samples_unreadable', 'None of the sampled files could be read from the clone', 422);
    }

    const { provider, model } = await this.deps.resolveModel(workspaceId, 'conventions');
    const llm = await this.deps.llm(provider);
    const system = await renderPrompt('conventions.system.md', {
      max: String(CONVENTION_MAX_CANDIDATES),
      rule_max: String(CONVENTION_RULE_MAX),
    });
    const res = await this.callModel(llm, {
      model,
      schema: ConventionExtraction,
      schemaName: EXTRACTION_SCHEMA_NAME,
      temperature: EXTRACTION_TEMPERATURE,
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildUserMessage(repo.fullName, configs, samples) },
      ],
    });

    // Grounding: only files we sent, only snippets that are really in them.
    const sent = new Map([...configs, ...samples]);
    const existing = await this.repo.list(workspaceId, repo.id);
    const acceptedRules = new Set(existing.filter((r) => r.accepted).map((r) => normalizeRule(r.rule)));
    const { kept, dropped } = verifyCandidates(res.data.conventions, sent, acceptedRules);
    if (dropped.length > 0) {
      this.deps.log.info({ repoId: repo.id, dropped }, 'conventions: candidates dropped by verification');
    }

    await this.repo.replaceCandidates(
      workspaceId,
      repo.id,
      kept.map((k) => ({
        rule: k.rule,
        evidencePath: k.evidencePath,
        evidenceSnippet: k.evidenceSnippet,
        evidenceLineStart: k.lines.start,
        evidenceLineEnd: k.lines.end,
        confidence: k.confidence,
      })),
    );
    const list = await this.list(workspaceId, repo.id);
    return {
      ...list,
      sampled_files: sent.size,
      kept: kept.length,
      dropped: dropped.length,
      model: res.model,
      tokens_in: res.tokensIn ?? null,
      tokens_out: res.tokensOut ?? null,
      cost_usd: res.costUsd ?? null,
    };
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConventionInput,
  ): Promise<ConventionCandidate> {
    const row = await this.repo.update(workspaceId, id, patch);
    if (!row) throw new NotFoundError('Convention not found');
    return toConventionDto(row);
  }

  /** Save the repo's accepted candidates as one `convention` / `extracted` skill. */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionSkillInput,
  ): Promise<Skill> {
    await this.requireRepo(workspaceId, repoId);
    const accepted = (await this.repo.list(workspaceId, repoId)).filter((r) => r.accepted);
    if (accepted.length === 0) throw new ValidationError('Accept at least one convention first');
    const evidenceFiles = [...new Set(accepted.map((r) => r.evidencePath).filter((p): p is string => !!p))];
    // A duplicate skill name surfaces as 409 from the skills service.
    return this.deps.skills.createExtracted(workspaceId, { ...input, evidenceFiles });
  }

  /** LLM failures (quota, timeout, bad JSON) are an upstream problem → 502, not 500. */
  private async callModel<T>(
    llm: LLMProvider,
    req: StructuredRequest<T>,
  ): Promise<StructuredResult<T>> {
    try {
      return await llm.completeStructured(req);
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError(`Conventions model call failed: ${msg}`);
    }
  }

  private async requireRepo(workspaceId: string, repoId: string): Promise<RepoRow> {
    const repo = await this.repo.findRepo(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  /** Read files from the clone, capped; unreadable/empty ones are skipped. */
  private async readFiles(
    ref: { owner: string; name: string },
    paths: readonly string[],
  ): Promise<Map<string, string>> {
    const git = this.deps.git();
    const out = new Map<string, string>();
    await Promise.all(
      paths.map(async (p) => {
        try {
          const content = await git.readFile(ref, p);
          if (content.trim()) out.set(p, capContent(content, MAX_FILE_CHARS));
        } catch {
          // Missing config / unreadable sample — skip it.
        }
      }),
    );
    // Keep the caller's order (Promise.all resolves out of order).
    return new Map(paths.filter((p) => out.has(p)).map((p) => [p, out.get(p)!]));
  }
}
