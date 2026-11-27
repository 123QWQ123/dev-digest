/* Agent Stats tab — 30-day aggregates of completed runs (M7 `AgentStats`
   contract): runs, accept rate, cost, latency, findings by severity and the
   review-score trend of the latest runs. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { BarRow, CircularScore, ErrorState, Skeleton, Sparkline } from "@devdigest/ui";
import { useAgentStats } from "@/lib/hooks/agents";
import { formatCost } from "@/components/run-cost";
import { StatPanel, StatTile, statStyles, toPercent } from "@/components/stats";
import { SEVERITY_ROWS } from "./constants";
import { formatLatency } from "./helpers";
import { s } from "./styles";

export function StatsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("agents.stats");
  const { data, isLoading, isError, refetch } = useAgentStats(agentId);

  if (isLoading) return <Skeleton height={92} />;
  if (isError || !data) return <ErrorState title={t("loadError")} onRetry={() => refetch()} />;

  const accept = toPercent(data.accept_rate);
  const maxSev = Math.max(1, ...SEVERITY_ROWS.map((r) => data.findings_by_severity[r.key]));
  return (
    <div style={s.wrap} data-testid="agent-stats">
      <div style={statStyles.tiles}>
        <StatTile label={t("runs")} value={data.runs} hint={t("runsHint")} />
        <StatTile
          label={t("acceptRate")}
          value={accept ?? "—"}
          unit={accept == null ? undefined : "%"}
          adornment={accept == null ? undefined : <CircularScore score={accept} size={30} stroke={3} />}
          hint={t("acceptHint", { accepted: data.accepted, dismissed: data.dismissed, pending: data.pending })}
        />
        <StatTile label={t("avgCost")} value={formatCost(data.avg_cost_usd)} hint={t("totalCost", { cost: formatCost(data.total_cost_usd) })} />
        <StatTile label={t("avgLatency")} value={formatLatency(data.avg_latency_ms)} />
      </div>
      <div style={statStyles.panels}>
        <StatPanel title={t("bySeverity", { total: data.findings_total })} icon="AlertTriangle">
          {SEVERITY_ROWS.map((r) => (
            <BarRow
              key={r.key}
              label={r.key}
              value={data.findings_by_severity[r.key]}
              max={maxSev}
              color={r.color}
              suffix={String(data.findings_by_severity[r.key])}
            />
          ))}
          <div style={s.sub}>
            {t("perRun", {
              value: data.avg_findings_per_run == null ? "—" : data.avg_findings_per_run.toFixed(1),
            })}
          </div>
        </StatPanel>
        <StatPanel title={t("scoreTrend", { count: data.trend.length })} icon="TrendingUp">
          {data.trend.length < 2 ? (
            <div style={s.sub}>{t("noTrend")}</div>
          ) : (
            <div style={s.trend}>
              <Sparkline data={data.trend.map((p) => p.value)} w={260} h={56} />
              <span style={s.sub}>
                {data.trend[0]!.label} → {data.trend[data.trend.length - 1]!.label}
              </span>
            </div>
          )}
        </StatPanel>
      </div>
      <p style={statStyles.footnote}>{t("footnote")}</p>
    </div>
  );
}
