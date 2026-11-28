import type { CSSProperties } from "react";

/** Co-located styles for SkillDetail. */
export const s = {
  header: { display: "flex", alignItems: "center", gap: 10, padding: "16px 28px 0", flexShrink: 0 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  actions: { marginLeft: "auto" } satisfies CSSProperties,
  tabsBar: { marginTop: 14 } satisfies CSSProperties,
  body: { flex: 1, minHeight: 0, overflow: "auto", padding: 28 } satisfies CSSProperties,
} as const;
