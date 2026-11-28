/** Usage-stats formatting shared by the Skills and Agents Stats tabs and cards. */

/** Rate 0..1 → whole percent; null (nothing to divide by) → null. */
export function toPercent(rate: number | null | undefined): number | null {
  return rate == null || !Number.isFinite(rate) ? null : Math.round(rate * 100);
}

/** "74%" or "—" when the rate is unknown. */
export function formatPercent(rate: number | null | undefined): string {
  const p = toPercent(rate);
  return p == null ? "—" : `${p}%`;
}

/** Finding category → legend colour (unknown categories fall back to muted). */
export const CATEGORY_COLOR: Record<string, string> = {
  security: "var(--crit)",
  bug: "var(--warn)",
  perf: "#a78bfa",
  style: "var(--info)",
  test: "var(--ok)",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLOR[category] ?? "var(--text-muted)";
}
