/* FindingsPanel — hide-low-confidence + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState, Icon, SEV, type Severity } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "@/lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings, severityCounts } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
  revealFindingId = null,
  revealNonce = 0,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
  /** Expand + scroll to this finding (navigation from the Timeline popover). */
  revealFindingId?: string | null;
  revealNonce?: number;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  // Severity filter pills — multi-select toggles; none selected = all severities.
  const [sevFilter, setSevFilter] = React.useState<ReadonlySet<string>>(() => new Set());
  const toggleSev = (sev: string) =>
    setSevFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  const [focusIdx, setFocusIdx] = React.useState(0);

  const counts = React.useMemo(() => severityCounts(findings, hideLow), [findings, hideLow]);
  // Selected severities that have no findings left (e.g. after hide-low) are
  // ignored, so the list never goes empty because of a pill you can't see.
  const activeSevs = React.useMemo(
    () => new Set([...sevFilter].filter((sev) => counts.some(([c]) => c === sev))),
    [sevFilter, counts],
  );
  const activeKey = [...activeSevs].sort().join(",");
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, activeSevs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [findings, hideLow, activeKey],
  );
  // Changing the severity filter resets keyboard focus to the first card —
  // adjusted during render (no effect → no extra render with a stale index).
  const [focusFilterKey, setFocusFilterKey] = React.useState(activeKey);
  if (focusFilterKey !== activeKey) {
    setFocusFilterKey(activeKey);
    setFocusIdx(0);
  }

  // Reveal request: make sure the target isn't hidden by the low-confidence or
  // severity filter, and move keyboard focus to it. The card expands + scrolls.
  React.useEffect(() => {
    if (!revealFindingId) return;
    const target = findings.find((f) => f.id === revealFindingId);
    if (!target) return;
    if (sevFilter.size > 0 && !sevFilter.has(target.severity)) {
      setSevFilter((prev) => new Set(prev).add(target.severity));
      return; // re-runs with the target's severity included
    }
    const visible = visibleFindings(findings, hideLow, sevFilter);
    if (!visible.some((f) => f.id === revealFindingId)) {
      setHideLow(false);
      return; // re-runs with the filter off
    }
    setFocusIdx(visible.findIndex((f) => f.id === revealFindingId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealFindingId, revealNonce, hideLow, sevFilter]);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        {counts.length > 0 && (
          <div style={s.pills} role="group" aria-label={t("panel.severityFilter")}>
            {counts.map(([sev, n]) => {
              const meta = SEV[sev as Severity];
              if (!meta) return null;
              const I = Icon[meta.icon];
              const active = activeSevs.has(sev);
              return (
                <button
                  key={sev}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSev(sev)}
                  style={s.pill(active, meta.c, meta.bg)}
                >
                  <I size={12} style={{ color: active ? meta.c : "var(--text-muted)" }} />
                  {t("panel.severityPill", { count: n, severity: meta.label })}
                </button>
              );
            })}
          </div>
        )}
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              revealNonce={f.id === revealFindingId ? revealNonce : undefined}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
