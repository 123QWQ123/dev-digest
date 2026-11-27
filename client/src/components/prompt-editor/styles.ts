import type { CSSProperties } from "react";

const LINE_H = 21;

export const s = {
  frame: {
    border: "1px solid var(--border-strong)",
    borderRadius: 7,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  head: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-secondary)",
    fontSize: 12,
  } satisfies CSSProperties,
  fileName: { fontSize: 12 } satisfies CSSProperties,
  unsaved: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--bg-hover)",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  tokens: (over: boolean): CSSProperties => ({
    marginLeft: "auto",
    fontSize: 12,
    color: over ? "var(--warn)" : "var(--text-muted)",
  }),
  body: (rows: number): CSSProperties => ({ display: "flex", height: rows * LINE_H + 20 }),
  gutter: {
    overflow: "hidden",
    padding: "10px 10px 10px 12px",
    textAlign: "right",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    lineHeight: `${LINE_H}px`,
    userSelect: "none",
    minWidth: 42,
    borderRight: "1px solid var(--border)",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    resize: "none",
    border: "none",
    outline: "none",
    padding: "10px 12px",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: `${LINE_H}px`,
    whiteSpace: "pre",
    overflow: "auto",
  } satisfies CSSProperties,
} as const;
