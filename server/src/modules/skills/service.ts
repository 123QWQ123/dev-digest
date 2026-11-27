import type {
  CreateSkillInput,
  Skill,
  SkillImportPreview,
  SkillStats,
  SkillVersion,
  UpdateSkillInput,
} from '@devdigest/shared';
import { ConflictError, ValidationError } from '../../platform/errors.js';
import { DuplicateSkillNameError, type SkillsRepository } from './repository.js';
import { STATS_WINDOW_DAYS } from '@devdigest/shared';
import {
  cardStats,
  isContentChange,
  toSkillDto,
  toSkillStats,
  toSkillVersionDto,
} from './helpers.js';
import { previewSkillImport, SkillImportError } from './domain/import.js';

/**
 * M2 — skills service. CRUD, version history/restore and the import preview.
 * A skill is TEXT ONLY (name, description, type, markdown body): it never runs
 * anything. Returns `undefined` for "not in this workspace" (route → 404).
 */
export class SkillsService {
  constructor(private repo: SkillsRepository) {}

  async list(workspaceId: string): Promise<Skill[]> {
    const [rows, runs, findings] = await Promise.all([
      this.repo.list(workspaceId),
      this.repo.runUsage(workspaceId, STATS_WINDOW_DAYS),
      this.repo.findingUsage(workspaceId, STATS_WINDOW_DAYS),
    ]);
    const stats = cardStats(runs, findings);
    const empty = { pull_rate: null, accept_rate: null };
    return rows.map((r) => ({ ...toSkillDto(r), stats: stats.get(r.id) ?? empty }));
  }

  /** Stats tab: usage over the last STATS_WINDOW_DAYS. undefined → 404. */
  async stats(workspaceId: string, id: string): Promise<SkillStats | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    const [usedBy, runs, findings] = await Promise.all([
      this.repo.linkedAgents(id),
      this.repo.runUsage(workspaceId, STATS_WINDOW_DAYS, id),
      this.repo.findingUsage(workspaceId, STATS_WINDOW_DAYS, id),
    ]);
    return toSkillStats(id, STATS_WINDOW_DAYS, usedBy, runs[0], findings);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.guardDuplicate(() =>
      this.repo.insert({
        workspaceId,
        name: input.name,
        description: input.description,
        type: input.type,
        source: input.source ?? 'manual',
        body: input.body,
        enabled: input.enabled,
        note: input.note ?? (input.source === 'imported' ? 'Imported' : 'Initial version'),
      }),
    );
    return toSkillDto({ ...row, agentCount: 0 });
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;
    const bumpVersion = isContentChange(existing, patch);
    const { note, ...fields } = patch;
    const row = await this.guardDuplicate(() =>
      this.repo.update(workspaceId, id, fields, { bumpVersion, note: note ?? null }),
    );
    return row ? toSkillDto({ ...row, agentCount: existing.agentCount }) : undefined;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    return (await this.repo.listVersions(id)).map(toSkillVersionDto);
  }

  async getVersion(
    workspaceId: string,
    id: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    const row = await this.repo.getVersion(id, version);
    return row ? toSkillVersionDto(row) : undefined;
  }

  /**
   * Restore = a NEW version carrying the old snapshot's content. History is
   * append-only, so past eval/trace references to a version stay valid.
   */
  async restore(workspaceId: string, id: string, version: number): Promise<Skill | undefined> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;
    const snap = await this.repo.getVersion(id, version);
    if (!snap) return undefined;
    const content = {
      body: snap.body,
      name: snap.name,
      description: snap.description,
      type: snap.type,
    };
    if (!isContentChange(existing, content)) return toSkillDto(existing);
    const row = await this.guardDuplicate(() =>
      this.repo.update(workspaceId, id, content, {
        bumpVersion: true,
        note: `Restored from v${version}`,
      }),
    );
    return row ? toSkillDto({ ...row, agentCount: existing.agentCount }) : undefined;
  }

  /** Parse an uploaded .md/.zip into a preview. Persists nothing. */
  previewImport(filename: string, contentBase64: string): SkillImportPreview {
    const bytes = new Uint8Array(Buffer.from(contentBase64, 'base64'));
    try {
      return previewSkillImport(filename, bytes);
    } catch (err) {
      if (err instanceof SkillImportError) throw new ValidationError(err.message);
      throw err;
    }
  }

  private async guardDuplicate<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DuplicateSkillNameError) throw new ConflictError(err.message);
      throw err;
    }
  }
}
