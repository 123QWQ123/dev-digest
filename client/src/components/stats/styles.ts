import type { CSSProperties } from "react";

/** Shared Stats-tab layout: a row of KPI tiles, then titled panels. */
export const s = {
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,
  tile: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: 16,
    minHeight: 92,
  } satisfies CSSProperties,
  tileHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 28,
  } satisfies CSSProperties,
  tileLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  tileValue: { display: "flex", alignItems: "baseline", gap: 4, marginTop: 6, fontSize: 28, fontWeight: 700 } satisfies CSSProperties,
  tileUnit: { fontSize: 15, fontWeight: 500, color: "var(--text-muted)" } satisfies CSSProperties,
  panels: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 12,
    marginTop: 12,
  } satisfies CSSProperties,
  panel: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: 16,
  } satisfies CSSProperties,
  panelTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 12,
  } satisfies CSSProperties,
  footnote: { fontSize: 12, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.5 } satisfies CSSProperties,
} as const;
