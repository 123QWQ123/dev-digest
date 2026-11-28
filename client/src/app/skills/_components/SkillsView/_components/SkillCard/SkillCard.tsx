/* SkillCard — name + type badge + enabled toggle + delete, description,
   "source · vN", and a usage footer (agents chip, pull freq, accept rate). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, IconBtn, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/skills";
import { formatPercent } from "@/components/stats";
import { s } from "./styles";

/** "—" for an unknown rate (no runs / nothing triaged), never a fake 0%. */
const rate = (v: number | null | undefined) => (v == null ? "—" : formatPercent(v));

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
  onDelete,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("skills");
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    // The whole card is a mouse target; the keyboard / screen-reader target is the
    // name <button> — interactive controls must not nest inside a role="button".
    <div onClick={onClick} style={s.card(!!active, skill.enabled)} data-testid={`skill-card-${skill.name}`}>
      <div style={s.headerRow}>
        <button
          type="button"
          style={s.name}
          title={skill.name}
          aria-pressed={!!active}
          onClick={(e) => {
            stop(e);
            onClick?.();
          }}
        >
          {skill.name}
        </button>
        <SkillTypeBadge type={skill.type} />
        <div style={s.actions} onClick={stop}>
          {onToggle && (
            <Toggle on={skill.enabled} onChange={onToggle} size={14} ariaLabel={t("card.toggleLabel")} />
          )}
          {onDelete && <IconBtn icon="Trash" label={t("card.deleteLabel")} size={22} onClick={onDelete} />}
        </div>
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.meta}>
        {t(`source.${skill.source}`)} · v{skill.version}
      </div>
      <div style={s.footer} title={t("card.statsHint")}>
        <span style={s.agentsChip}>
          <Icon.Cpu size={12} />
          {t("card.agents", { count: skill.agent_count ?? 0 })}
        </span>
        <span>{t("card.pull", { value: rate(skill.stats?.pull_rate) })}</span>
        <span>{t("card.accept", { value: rate(skill.stats?.accept_rate) })}</span>
      </div>
    </div>
  );
}
