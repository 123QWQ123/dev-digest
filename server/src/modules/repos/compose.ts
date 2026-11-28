import type { Container } from '../../platform/container.js';
import { RepoRepository } from './repository.js';
import { RepoService } from './service.js';

/** Module composition root: builds the repos service from the app container. */
export function createRepoService(container: Pick<Container, 'db' | 'git' | 'jobs'>): RepoService {
  return new RepoService(container, new RepoRepository(container.db));
}
