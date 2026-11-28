import type { CSSProperties } from "react";

/** Co-located styles for SkillsMain (the right pane). */
export const s = {
  mainScroll: { flex: 1, minHeight: 0, overflow: "auto", padding: 28 } satisfies CSSProperties,
  /** Design: muted, centred "Select a skill" hint — no icon. */
  selectPrompt: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    textAlign: "center",
  } satisfies CSSProperties,
  selectPromptTitle: { fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" } satisfies CSSProperties,
  selectPromptBody: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
