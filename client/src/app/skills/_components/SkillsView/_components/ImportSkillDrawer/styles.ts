import type { CSSProperties } from "react";

const box: CSSProperties = {
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 12,
  fontSize: 13,
};

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  picker: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px dashed var(--border-strong)",
    cursor: "pointer",
    color: "var(--text-secondary)",
    fontSize: 14,
  } satisfies CSSProperties,
  fileInput: { marginLeft: "auto", fontSize: 12 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)", margin: "10px 0" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", margin: "10px 0" } satisfies CSSProperties,
  result: { marginTop: 16 } satisfies CSSProperties,
  box: { ...box, border: "1px solid var(--border)", background: "var(--bg-elevated)" } satisfies CSSProperties,
  warnBox: { ...box, border: "1px solid var(--warn)", background: "var(--warn-bg)" } satisfies CSSProperties,
  boxTitle: { fontWeight: 600, marginBottom: 6 } satisfies CSSProperties,
  ul: { margin: 0, paddingLeft: 18, color: "var(--text-secondary)" } satisfies CSSProperties,
  trust: {
    ...box,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    marginTop: 8,
  } satisfies CSSProperties,
  trustBody: { color: "var(--text-secondary)", margin: "0 0 10px" } satisfies CSSProperties,
} as const;
