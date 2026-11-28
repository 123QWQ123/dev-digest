import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 980 } satisfies CSSProperties,
  sub: { fontSize: 12, color: "var(--text-muted)", marginTop: 8 } satisfies CSSProperties,
  trend: { display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 } satisfies CSSProperties,
} as const;
