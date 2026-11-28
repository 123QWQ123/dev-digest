import type { IconName } from "@devdigest/ui";

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
