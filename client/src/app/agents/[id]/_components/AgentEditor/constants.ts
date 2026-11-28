import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under the `agents` namespace. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Editor tabs. M2 adds Skills and Stats; Evals/CI arrive with M6. */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "skills", labelKey: "editor.tabs.skills", icon: "Sparkles" },
  { key: "stats", labelKey: "editor.tabs.stats", icon: "BarChart" },
];

/** Tab keys accepted in `?tab=`. */
export const TAB_KEYS: readonly string[] = TABS.map((tb) => tb.key);
