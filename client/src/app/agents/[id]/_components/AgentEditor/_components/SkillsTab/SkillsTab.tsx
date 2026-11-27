"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useAgentSkills, useSetAgentSkills, useSkills } from "@/lib/hooks/skills";
import { SkillTypeBadge } from "@/components/skills";
import {
  buildRows,
  effectiveCount,
  matchesFilter,
  moveRow,
  toggleRow,
  toLinks,
  type SkillRow,
} from "./helpers";
import { s } from "./styles";

/**
 * Skills tab — attach / enable / reorder workspace skills for one agent.
 * Linked skills come first, in prompt order; every change is saved at once
 * (optimistic). Reorder by native drag-and-drop or the ↑/↓ buttons.
 */
export function SkillsTab({ agentId }: { agentId: string }) {
  const t = useTranslations("agents");
  const skills = useSkills();
  const links = useAgentSkills(agentId);
  const setLinks = useSetAgentSkills(agentId);
  const [filter, setFilter] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  if (skills.isLoading || links.isLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={24} width={200} />
        <Skeleton height={160} />
      </div>
    );
  }
  if (skills.isError || links.isError) {
    return (
      <ErrorState
        body={t("skills.loadError")}
        onRetry={() => {
          skills.refetch();
          links.refetch();
        }}
      />
    );
  }

  const rows = buildRows(links.data ?? [], skills.data ?? []);
  const linkedRows = rows.filter((r) => r.linked);
  const reorderable = filter.trim() === "";

  const commit = (next: SkillRow[]) => {
    const optimistic = toLinks(next);
    // Failures surface via the global mutation error toast; the hook rolls back.
    setLinks.mutate({
      items: optimistic.map((l) => ({ skill_id: l.skill_id, enabled: l.enabled })),
      optimistic,
    });
  };

  if (rows.length === 0) {
    return (
      <div style={s.wrap}>
        <EmptyState icon="Sparkles" title={t("skills.empty")} />
        <Link href="/skills">{t("skills.createSkill")}</Link>
      </div>
    );
  }

  const visible = rows.filter((r) => matchesFilter(r, filter));
  const firstUnlinked = visible.findIndex((r) => !r.linked);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { linked: effectiveCount(rows), total: rows.length })}
        </Badge>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("skills.filterPlaceholder")}
          aria-label={t("skills.filterPlaceholder")}
          style={s.filter}
        />
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {visible.length === 0 && <p style={s.hint}>{t("skills.noMatch")}</p>}
      <div style={s.list} role="list">
        {visible.map((row, i) => {
          const index = linkedRows.findIndex((r) => r.skill_id === row.skill_id);
          const canDrag = row.linked && reorderable;
          return (
            <React.Fragment key={row.skill_id}>
              {i === firstUnlinked && i > 0 && <div style={s.divider} />}
              <div
                role="listitem"
                data-testid={`skill-row-${row.name}`}
                draggable={canDrag}
                onDragStart={(e) => {
                  setDragId(row.skill_id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!dragId || !canDrag) return;
                  e.preventDefault();
                  setOverId(row.skill_id);
                }}
                onDragLeave={() => setOverId((cur) => (cur === row.skill_id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && canDrag && dragId !== row.skill_id) {
                    commit(moveRow(rows, dragId, index));
                  }
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                style={s.row(row.linked, dragId === row.skill_id, overId === row.skill_id)}
              >
                <span style={s.grip(canDrag)} aria-label={t("skills.dragHandle", { name: row.name })}>
                  <Icon.Menu size={14} />
                </span>
                <div style={{ ...s.arrows, visibility: canDrag ? "visible" : "hidden" }}>
                  <button
                    type="button"
                    style={s.arrowBtn}
                    aria-label={t("skills.moveUp", { name: row.name })}
                    disabled={!canDrag || index === 0}
                    onClick={() => commit(moveRow(rows, row.skill_id, index - 1))}
                  >
                    <Icon.ChevronDown size={12} style={{ transform: "rotate(180deg)" }} />
                  </button>
                  <button
                    type="button"
                    style={s.arrowBtn}
                    aria-label={t("skills.moveDown", { name: row.name })}
                    disabled={!canDrag || index === linkedRows.length - 1}
                    onClick={() => commit(moveRow(rows, row.skill_id, index + 1))}
                  >
                    <Icon.ChevronDown size={12} />
                  </button>
                </div>
                <Checkbox
                  checked={row.linked && row.enabled}
                  onChange={() => commit(toggleRow(rows, row.skill_id))}
                  label={
                    <span className="mono" style={s.name(!row.skill_enabled)}>
                      {row.name}
                    </span>
                  }
                />
                <span style={s.desc}>{row.description}</span>
                {!row.skill_enabled && (
                  <Badge color="var(--text-muted)">{t("skills.globallyDisabled")}</Badge>
                )}
                <SkillTypeBadge type={row.type} />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
