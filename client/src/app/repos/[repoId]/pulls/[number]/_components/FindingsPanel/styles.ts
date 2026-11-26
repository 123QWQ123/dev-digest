import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  pills: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  /** Severity filter pill; `active` paints it in the severity's colour. */
  pill: (active: boolean, color: string, bg: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? color : "var(--border)"}`,
    background: active ? bg : "transparent",
    color: active ? color : "var(--text-secondary)",
    font: "inherit",
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "border-color .12s, background .12s, color .12s",
  }),
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
