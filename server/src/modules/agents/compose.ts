import type { Container } from '../../platform/container.js';
import { AgentsService } from './service.js';

/** Module composition root: builds the agents service from the app container. */
export function createAgentsService(container: Pick<Container, 'agentsRepo' | 'llm'>): AgentsService {
  return new AgentsService(container, container.agentsRepo);
}
