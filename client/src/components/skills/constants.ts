import type { SkillType } from "@devdigest/shared";

export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/**
 * Client-local mirror of the skill limits in `@devdigest/shared`
 * (SKILL_BODY_MAX, SkillName). The client may import only TYPES from the vendored
 * shared package — a runtime value pulls `vendor/shared/index.ts` into webpack,
 * whose `./contracts/*.js` re-exports it can't resolve (see lib/feature-models.ts).
 * Keep in sync; the server validates authoritatively anyway.
 */
export const SKILL_BODY_MAX = 20_000;
export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
