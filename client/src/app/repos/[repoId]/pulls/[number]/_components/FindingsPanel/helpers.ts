import type { FindingRecord } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally drop low-confidence findings, keep only the selected severities
 *  (empty = all), and sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severities: ReadonlySet<string> = new Set(),
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severities.size > 0) shown = shown.filter((f) => severities.has(f.severity));
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/** Severity → count over the confidence-filtered set, in display order
 *  (CRITICAL → INFO); severities with no findings are omitted. */
export function severityCounts(findings: FindingRecord[], hideLow: boolean): [string, number][] {
  const counts = new Map<string, number>();
  for (const f of visibleFindings(findings, hideLow)) counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
  return [...counts.entries()];
}
