import type { IconName } from "@devdigest/ui";
import type { SkillSource, SkillType } from "@devdigest/shared";

export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Detail tabs. `labelKey` resolves under the `skills` namespace. */
export const DETAIL_TABS: readonly { key: string; labelKey: string; icon: IconName }[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "stats", labelKey: "detail.tabs.stats", icon: "BarChart" },
  { key: "versions", labelKey: "detail.tabs.versions", icon: "History" },
];
export const DETAIL_TAB_KEYS: readonly string[] = DETAIL_TABS.map((tb) => tb.key);

/** Client-side guard matching the server's 1 MB upload limit. */
export const IMPORT_MAX_BYTES = 1_048_576;

/**
 * Client-local mirror of the skill limits in `@devdigest/shared`
 * (SKILL_BODY_MAX, SkillName). The client may import only TYPES from the vendored
 * shared package — a runtime value pulls `vendor/shared/index.ts` into webpack,
 * whose `./contracts/*.js` re-exports it can't resolve (see lib/feature-models.ts).
 * Keep in sync; the server validates authoritatively anyway.
 */
export const SKILL_BODY_MAX = 20_000;
export const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Card source label icon (design: Manual / Extracted / Community / Imported). */
export const SOURCE_ICON: Record<SkillSource, IconName> = {
  manual: "Edit",
  imported: "Upload",
  imported_url: "Link",
  extracted: "Sparkles",
  community: "Users",
};
