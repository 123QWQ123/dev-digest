import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrCommentInput, PrDetail, PrMeta, PrReviewComment } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { createPullsService } from './compose.js';

/**
 * F1 — pulls module (edge). Thin HTTP layer over PullsService.
 *   GET  /repos/:id/pulls    → list PRs for a repo (synced from GitHub when reachable,
 *                              persisted). `status` = review freshness for open PRs.
 *   GET  /pulls/:id          → full PR detail (diff/files, commits, body, linked issue)
 *   GET  /pulls/:id/comments → inline review comments, proxied live to GitHub
 *   POST /pulls/:id/comments → create an inline comment pinned to the head sha
 *
 * Import is idempotent (unique repo_id+number). Review trigger is MANUAL
 * and owned by the reviews module — this module only imports/reads.
 */
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const pulls = createPullsService(container, app.log);

  app.get('/repos/:id/pulls', { schema: { params: IdParams, response: { 200: PrMeta.array() } } }, async (req): Promise<PrMeta[]> => {
    const { workspaceId } = await getContext(container, req);
    return pulls.listForRepo(workspaceId, req.params.id);
  });

  app.get('/pulls/:id', { schema: { params: IdParams, response: { 200: PrDetail } } }, async (req): Promise<PrDetail> => {
    const { workspaceId } = await getContext(container, req);
    return pulls.getDetail(workspaceId, req.params.id);
  });

  app.get(
    '/pulls/:id/comments',
    { schema: { params: IdParams, response: { 200: PrReviewComment.array() } } },
    async (req): Promise<PrReviewComment[]> => {
      const { workspaceId } = await getContext(container, req);
      return pulls.listComments(workspaceId, req.params.id);
    },
  );

  app.post(
    '/pulls/:id/comments',
    { schema: { params: IdParams, body: PrCommentInput, response: { 200: PrReviewComment } } },
    async (req): Promise<PrReviewComment> => {
      const { workspaceId } = await getContext(container, req);
      return pulls.createComment(workspaceId, req.params.id, req.body);
    },
  );
}
