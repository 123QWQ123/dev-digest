/* Skill Stats tab — 30-day usage: agents using it, pull frequency, accept rate,
   findings and their categories. Findings are attributed by co-occurrence: a
   finding counts for every skill that was in its run's prompt. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CircularScore, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkillStats } from "@/lib/hooks/skills";
import { CategoryDonut, StatPanel, StatTile, statStyles, toPercent } from "@/components/stats";
import { s } from "./styles";

export function StatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills.stats");
  const { data, isLoading, isError, refetch } = useSkillStats(skillId);

  if (isLoading) return <Skeleton height={92} />;
  if (isError || !data) return <ErrorState title={t("loadError")} onRetry={() => refetch()} />;

  const pull = toPercent(data.pull_rate);
  const accept = toPercent(data.accept_rate);
  return (
    <div style={s.wrap} data-testid="skill-stats">
      <div style={statStyles.tiles}>
        <StatTile label={t("usedBy")} value={data.used_by.length} unit={t("agentsUnit", { count: data.used_by.length })} />
        <StatTile
          label={t("pullFrequency")}
          value={pull ?? "—"}
          unit={pull == null ? undefined : "%"}
          hint={t("pullHint", { used: data.runs_with_skill, runs: data.agent_runs })}
        />
        <StatTile
          label={t("acceptRate")}
          value={accept ?? "—"}
          unit={accept == null ? undefined : "%"}
          adornment={accept == null ? undefined : <CircularScore score={accept} size={30} stroke={3} />}
          hint={t("acceptHint")}
        />
        <StatTile label={t("findings", { days: data.window_days })} value={data.findings} />
      </div>
      <div style={statStyles.panels}>
        <StatPanel title={t("agentsUsing")} icon="Cpu">
          {data.used_by.length === 0 ? (
            <div style={s.empty}>{t("noAgents")}</div>
          ) : (
            data.used_by.map((a) => (
              <div key={a.id} style={s.agentRow(a.enabled)}>
                <Icon.Cpu size={14} style={{ color: "var(--accent)" }} />
                <span style={s.agentName}>{a.name}</span>
                {!a.enabled && <span style={s.off}>{t("linkOff")}</span>}
                <Link href={`/agents/${a.id}?tab=skills`} style={s.open}>
                  {t("open")}
                </Link>
              </div>
            ))
          )}
        </StatPanel>
        <StatPanel title={t("byCategory")} icon="Tag">
          <CategoryDonut data={data.findings_by_category} empty={t("noFindings")} />
        </StatPanel>
      </div>
      <p style={statStyles.footnote}>{t("footnote", { days: data.window_days })}</p>
    </div>
  );
}
