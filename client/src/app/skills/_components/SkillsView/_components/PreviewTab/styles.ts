import type { CSSProperties } from "react";

/** Co-located styles for PreviewTab. Typography inside the card lives in `.skill-prose` (globals.css). */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 6 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", marginBottom: 16 } satisfies CSSProperties,
  card: {
    padding: "24px 28px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 14,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  empty: { color: "var(--text-muted)" } satisfies CSSProperties,
  notice: {
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "var(--warn-bg)",
    border: "1px solid var(--warn)",
    borderRadius: 8,
    padding: "10px 12px",
    marginBottom: 16,
  } satisfies CSSProperties,
} as const;
