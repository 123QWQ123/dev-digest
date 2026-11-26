/* PrFindingsCell — the PR list's FINDINGS column: critical / warning /
   suggestion counters of the PR's latest review round — the newest run of
   EVERY agent (older reruns ignored). Counts arrive with the list
   (`PrMeta.latest_round`); the findings themselves are fetched only when a
   counter's popover opens. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { PrMeta } from "@/lib/types";
import { usePrReviews } from "@/lib/hooks/reviews";
import {
  SeverityCountPopover,
  type CountedSeverity,
} from "../../[number]/_components/RunHistory/SeverityCountPopover";
import { s } from "../../styles";

const SEVERITIES: { severity: CountedSeverity; key: "critical" | "warning" | "suggestion" }[] = [
  { severity: "CRITICAL", key: "critical" },
  { severity: "WARNING", key: "warning" },
  { severity: "SUGGESTION", key: "suggestion" },
];

export function PrFindingsCell({ pr, repoId }: { pr: PrMeta; repoId: string }) {
  const router = useRouter();
  const latest = pr.latest_round ?? null;
  // Lazy: nothing is fetched until a popover opens.
  const [wanted, setWanted] = React.useState(false);
  const { data: reviews, isLoading } = usePrReviews(wanted && latest ? pr.id : null);
  // Findings of the round's reviews + finding id → the run that produced it
  // (each agent's finding deep-links into its own run).
  const { findings, runOf } = React.useMemo(() => {
    const ids = new Set(latest?.review_ids ?? []);
    const round = (reviews ?? []).filter((r) => ids.has(r.id));
    const runOf = new Map<string, string>();
    for (const r of round) if (r.run_id) for (const f of r.findings) runOf.set(f.id, r.run_id);
    return { findings: round.flatMap((r) => r.findings), runOf };
  }, [reviews, latest?.review_ids]);

  if (!latest) return <div style={s.muted}>—</div>;
  const total = latest.critical + latest.warning + latest.suggestion;

  // Counter click → the PR's Agent runs tab (the round spans several runs);
  // finding click → that finding in its own run (FindingsTab reads
  // `run` / `finding` and expands + scrolls to it).
  const goTo = (findingId?: string) => {
    const sp = new URLSearchParams({ tab: "findings" });
    const runId = findingId ? runOf.get(findingId) : undefined;
    if (findingId && runId) {
      sp.set("run", runId);
      sp.set("finding", findingId);
    }
    router.push(`/repos/${repoId}/pulls/${pr.number}?${sp.toString()}`);
  };

  return (
    // stopPropagation: the row itself navigates on click; the counters do
    // their own (deep-linked) navigation.
    <div style={s.findingsCell} onClick={(e) => e.stopPropagation()}>
      {total === 0 ? (
        <span style={s.muted}>0</span>
      ) : (
        SEVERITIES.map(({ severity, key }) => (
          <SeverityCountPopover
            key={severity}
            severity={severity}
            count={latest[key]}
            findings={findings.filter((f) => f.severity === severity)}
            loading={wanted && isLoading}
            onOpen={() => setWanted(true)}
            align="right"
            onSelect={goTo}
          />
        ))
      )}
    </div>
  );
}
