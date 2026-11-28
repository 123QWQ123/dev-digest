import type { CSSProperties } from "react";

export const s = {
  body: { padding: "18px 24px" } satisfies CSSProperties,
  banner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    marginBottom: 18,
    borderRadius: 8,
    background: "var(--accent-bg)",
    color: "var(--text-secondary)",
    fontSize: 13,
  } satisfies CSSProperties,
} as const;
