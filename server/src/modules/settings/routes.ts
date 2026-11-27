import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { SettingsUpdate, ConnTestRequest, ConnTestResult, SecretsStatus } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { createSettingsService } from './compose.js';

/**
 * F1 — settings module (edge).
 *   GET  /settings                 → current non-secret prefs
 *   GET  /settings/secrets-status  → which provider keys are configured (booleans only)
 *   PUT  /settings                 → upsert prefs (key/value rows)
 *   POST /settings/test-connection → test a provider key (OpenAI/Anthropic/OpenRouter/GitHub)
 *
 * Secrets are NOT stored here — only non-secret prefs. test-connection reads
 * the key via SecretsProvider and does a cheap live call (listModels / GET user).
 */
export default async function settingsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const settings = createSettingsService(container);

  app.get('/settings', async (req) => {
    const { workspaceId } = await getContext(container, req);
    return settings.get(workspaceId);
  });

  app.get('/settings/secrets-status', { schema: { response: { 200: SecretsStatus } } }, async (req): Promise<SecretsStatus> => {
    await getContext(container, req);
    return settings.secretsStatus();
  });

  app.put('/settings', { schema: { body: SettingsUpdate } }, async (req) => {
    const { workspaceId, userId } = await getContext(container, req);
    return settings.update(workspaceId, userId, req.body);
  });

  app.post(
    '/settings/test-connection',
    {
      schema: { body: ConnTestRequest, response: { 200: ConnTestResult } },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req): Promise<ConnTestResult> => settings.testConnection(req.body),
  );
}
