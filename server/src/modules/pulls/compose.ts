import type { Container } from '../../platform/container.js';
import { PullsRepository } from './repository.js';
import { PullsService, type PullsLogger } from './service.js';

/**
 * Module composition root: the one place that builds the pulls service from
 * the app container. Routes import this, never the repository.
 */
export function createPullsService(
  container: Pick<Container, 'db' | 'github'>,
  log: PullsLogger,
): PullsService {
  return new PullsService({
    repo: new PullsRepository(container.db),
    github: () => container.github(),
    log,
  });
}
