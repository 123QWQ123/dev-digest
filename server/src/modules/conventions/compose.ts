import type { Container } from '../../platform/container.js';
import { createSkillsService } from '../skills/index.js';
import { createFeatureModelResolver } from '../settings/index.js';
import { ConventionsRepository } from './repository.js';
import { ConventionsService, type ConventionsLogger } from './service.js';

/**
 * In-flight extractions by repo id. Module-level (not per service instance) so
 * every request in this process sees the same lock — a double click on Re-scan
 * gets 409 instead of a second LLM call racing on replaceCandidates.
 */
const inFlight = new Set<string>();

/** Module composition root: builds the conventions service from the app container. */
export function createConventionsService(
  container: Pick<Container, 'db' | 'llm' | 'git' | 'repoIntel'>,
  log: ConventionsLogger,
): ConventionsService {
  return new ConventionsService(
    {
      // Explicit getters: repoIntel/git are lazy class getters, a spread would drop them.
      llm: (id) => container.llm(id),
      git: () => container.git,
      repoIntel: () => container.repoIntel,
      resolveModel: createFeatureModelResolver(container),
      skills: createSkillsService(container),
      inFlight,
      log,
    },
    new ConventionsRepository(container.db),
  );
}
