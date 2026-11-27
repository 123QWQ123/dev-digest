import type { Container } from '../../platform/container.js';
import { SkillsRepository } from './repository.js';
import { SkillsService } from './service.js';

/** Module composition root: builds the skills service from the app container. */
export function createSkillsService(container: Pick<Container, 'db'>): SkillsService {
  return new SkillsService(new SkillsRepository(container.db));
}
