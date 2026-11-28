import type { Container } from '../../platform/container.js';
import { RepoIntelRepository } from './repository.js';
import { RepoIntelService, type RepoIntelServiceDeps } from './service.js';

/** Module composition root: builds the repo-intel service from the app container. */
export function createRepoIntelService(container: RepoIntelServiceDeps & Pick<Container, 'db'>): RepoIntelService {
  return new RepoIntelService(container, new RepoIntelRepository(container.db));
}
