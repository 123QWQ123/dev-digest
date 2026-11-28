import type { CSSProperties } from "react";

/** Co-located styles for SkillCard (design: Skills Lab list card). */
export const s = {
  card: (active: boolean, enabled: boolean): CSSProperties => ({
    padding: "12px 14px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid " + (active ? "var(--border-strong)" : "var(--border)"),
    background: active ? "var(--bg-hover)" : "var(--bg-elevated)",
    opacity: enabled ? 1 : 0.6,
    marginBottom: 10,
  }),
  headerRow: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } satisfies CSSProperties,
  name: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  actions: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 } satisfies CSSProperties,
  description: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginTop: 8,
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  meta: { fontSize: 11, color: "var(--text-muted)", marginTop: 6 } satisfies CSSProperties,
  footer: {
    marginTop: 10,
    fontSize: 11,
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  agentsChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    borderRadius: 6,
    background: "var(--bg-hover)",
    color: "var(--text-secondary)",
    fontSize: 12,
    fontWeight: 600,
  } satisfies CSSProperties,
} as const;
