import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 980 } satisfies CSSProperties,
  agentRow: (enabled: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: 7,
    marginBottom: 8,
    opacity: enabled ? 1 : 0.65,
  }),
  agentName: { flex: 1, fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  off: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  open: { fontSize: 12, color: "var(--text-secondary)", textDecoration: "none" } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)", padding: "8px 0" } satisfies CSSProperties,
} as const;
