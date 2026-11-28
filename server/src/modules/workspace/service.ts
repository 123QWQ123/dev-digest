import type { WorkspaceRepository } from './repository.js';

export interface WorkspaceOverview {
  workspaceId: string;
  cloneDir: string;
  repos: {
    id: string;
    full_name: string;
    clone_path: string | null;
    last_polled_at: string | null;
    cloned: boolean;
  }[];
}

/** F1 — workspace manager: where clones live + a summary of cloned repos. */
export class WorkspaceService {
  constructor(private deps: { repo: WorkspaceRepository; cloneDir: string }) {}

  async overview(workspaceId: string): Promise<WorkspaceOverview> {
    const repos = await this.deps.repo.listRepos(workspaceId);
    return {
      workspaceId,
      cloneDir: this.deps.cloneDir,
      repos: repos.map((r) => ({
        id: r.id,
        full_name: r.fullName,
        clone_path: r.clonePath,
        last_polled_at: r.lastPolledAt?.toISOString() ?? null,
        cloned: Boolean(r.clonePath),
      })),
    };
  }
}
