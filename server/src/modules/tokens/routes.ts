import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CountTokensInput, TokenCount } from '@devdigest/shared';
import { createTokensService } from './compose.js';

/**
 * tokens module (M2).
 *   POST /tokens/count  { text } → { tokens }   — live counter in the editors
 * Pure computation: no DB, no workspace data.
 */
export default async function tokensRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = createTokensService(app.container);

  app.post(
    '/tokens/count',
    { schema: { body: CountTokensInput, response: { 200: TokenCount } } },
    async (req) => ({ tokens: service.count(req.body.text) }),
  );
}
