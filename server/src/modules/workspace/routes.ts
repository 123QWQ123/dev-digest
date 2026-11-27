import type { FastifyInstance } from 'fastify';
import { getContext } from '../_shared/context.js';
import { createWorkspaceService } from './compose.js';

/**
 * F1 — workspace manager (edge): where clones live + a summary of cloned repos.
 *   GET /workspace        → workspace info + cloneDir + cloned repos summary
 *
 * Cleanup/re-pull of individual repos is handled by the repos module
 * (refresh/delete); this surface gives the UI an overview.
 */
export default async function workspaceRoutes(app: FastifyInstance) {
  const { container } = app;
  const workspace = createWorkspaceService(container);

  app.get('/workspace', async (req) => {
    const { workspaceId } = await getContext(container, req);
    return workspace.overview(workspaceId);
  });
}
