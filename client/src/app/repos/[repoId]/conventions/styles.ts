import type { CSSProperties } from "react";

/** Co-located styles for the Conventions page. */
export const s = {
  page: { maxWidth: 900, margin: "0 auto", padding: "28px 32px" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 } satisfies CSSProperties,
  title: { fontSize: 22, fontWeight: 700 } satisfies CSSProperties,
  repo: { color: "var(--accent)" } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4 } satisfies CSSProperties,
  headerActions: { marginLeft: "auto" } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  spacer: { flex: 1 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
