"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { DETAIL_TABS } from "../../constants";
import { isUntrusted } from "../../helpers";
import { PreviewTab } from "../PreviewTab";
import { SkillForm, SkillTypeBadge, type SkillFormValues } from "@/components/skills";
import { StatsTab } from "../StatsTab";
import { VersionsTab } from "../VersionsTab";
import { s } from "./styles";

/** Selected skill: header + Config / Preview / Versions tabs. */
export function SkillDetail({
  skill,
  tab,
  onTab,
  onDeleted,
}: {
  skill: Skill;
  tab: string;
  onTab: (t: string) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const untrusted = isUntrusted(skill);
  const tabs = DETAIL_TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  const save = (v: SkillFormValues) =>
    update.mutate(
      {
        id: skill.id,
        patch: {
          name: v.name,
          description: v.description,
          type: v.type,
          body: v.body,
          enabled: v.enabled,
          ...(v.note.trim() ? { note: v.note.trim() } : {}),
        },
      },
      { onSuccess: (sk) => toast.success(t("form.savedToast", { version: sk.version })) },
    );

  const remove = () => {
    if (!window.confirm(t("detail.deleteConfirm", { name: skill.name }))) return;
    del.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("detail.deleted"));
        onDeleted();
      },
    });
  };

  return (
    <>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h1 className="mono" style={s.h1}>
          {skill.name}
        </h1>
        <SkillTypeBadge type={skill.type} />
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          v{skill.version}
        </Badge>
        {untrusted && (
          <Badge color="var(--warn)" icon="AlertTriangle">
            {t("preview.untrustedBadge")}
          </Badge>
        )}
        <div style={s.actions}>
          <Button kind="secondary" size="sm" icon="Trash" onClick={remove} disabled={del.isPending}>
            {t("detail.delete")}
          </Button>
        </div>
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 28px" />
      </div>
      <div style={s.body}>
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "stats" && <StatsTab skillId={skill.id} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
        {tab === "config" && (
          // key: a new version (save/restore) or another skill reseeds the form.
          <SkillForm
            key={`${skill.id}:${skill.version}`}
            mode="edit"
            version={skill.version}
            submitting={update.isPending}
            initial={{
              name: skill.name,
              description: skill.description,
              type: skill.type,
              body: skill.body,
              enabled: skill.enabled,
              note: "",
            }}
            onSubmit={save}
          />
        )}
      </div>
    </>
  );
}
