import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ConventionCandidate,
  ConventionList,
  CreateConventionSkillInput,
  ExtractConventionsResult,
  Skill,
  UpdateConventionInput,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { createConventionsService } from './compose.js';

/** Extract takes no options yet; an empty POST body arrives as null. */
const ExtractBody = z.preprocess((v) => v ?? {}, z.object({}).strict());

/**
 * M2 — Conventions Extractor.
 *   GET   /repos/:id/conventions          → candidates + last scan time
 *   POST  /repos/:id/conventions/extract  → sample → 1 LLM call → verify → store (sync)
 *   PATCH /conventions/:id                → edit rule / accept / reject
 *   POST  /repos/:id/conventions/skill    → accepted candidates → one convention skill
 */
export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = createConventionsService(app.container, app.log);

  app.get(
    '/repos/:id/conventions',
    { schema: { params: IdParams, response: { 200: ConventionList } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.list(workspaceId, req.params.id);
    },
  );

  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams, body: ExtractBody, response: { 200: ExtractConventionsResult } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.extract(workspaceId, req.params.id);
    },
  );

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionInput, response: { 200: ConventionCandidate } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.update(workspaceId, req.params.id, req.body);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateConventionSkillInput, response: { 201: Skill } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.createSkill(workspaceId, req.params.id, req.body);
      reply.status(201);
      return skill;
    },
  );
}
