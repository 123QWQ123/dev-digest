import type { Container } from '../../platform/container.js';
import { WorkspaceRepository } from './repository.js';
import { WorkspaceService } from './service.js';

/** Module composition root: builds the workspace service from the app container. */
export function createWorkspaceService(container: Pick<Container, 'db' | 'config'>): WorkspaceService {
  return new WorkspaceService({
    repo: new WorkspaceRepository(container.db),
    cloneDir: container.config.cloneDir,
  });
}
