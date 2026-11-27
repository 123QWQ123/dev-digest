/* SkillCard — name, type badge, description, source, usage and the global
   enabled toggle. Mirrors AgentCard. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skills";
import { formatPercent } from "@/components/stats";
import { SOURCE_ICON } from "../../constants";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)} data-testid={`skill-card-${skill.name}`}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={14} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()} aria-label={t("card.toggleLabel")}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.metaRow}>
        <SkillTypeBadge type={skill.type} />
        <span style={s.meta}>
          {React.createElement(Icon[SOURCE_ICON[skill.source]], { size: 12 })}
          {t(`source.${skill.source}`)}
        </span>
      </div>
      <div style={s.footer} title={t("card.statsHint")}>
        <span>{t("card.agents", { count: skill.agent_count ?? 0 })}</span>
        {skill.stats?.pull_rate != null && (
          <span>{t("card.pull", { value: formatPercent(skill.stats.pull_rate) })}</span>
        )}
        {skill.stats?.accept_rate != null && (
          <span style={s.accept}>{t("card.accept", { value: formatPercent(skill.stats.accept_rate) })}</span>
        )}
      </div>
    </div>
  );
}
