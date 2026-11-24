/**
 * M1 run-cost formatting (client/specs/m1-run-cost.md).
 * Missing data is ALWAYS "—", never "$0.00": `null`/`undefined` = unknown
 * (pre-M1 run, failed run, unpriced model); a real 0 = known free model.
 */
export const NO_COST = "—";

/** USD with adaptive precision: <$0.01 → 4 dp, <$1 → 3 dp, else 2 dp. */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return NO_COST;
  if (usd === 0) return "$0.00";
  const dp = usd < 0.01 ? 4 : usd < 1 ? 3 : 2;
  return `$${usd.toFixed(dp)}`;
}

/** Integer with narrow-no-break-space thousands separators: 9119 → "9 119". */
export function formatTokenCount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
