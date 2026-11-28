"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import { SkillForm, EMPTY_SKILL, type SkillFormValues } from "@/components/skills";
import { SkillDetail } from "../SkillDetail";
import { s } from "./styles";

export interface SkillsMainCreate {
  active: boolean;
  pending: boolean;
  onSubmit: (values: SkillFormValues) => void;
  onCancel: () => void;
}

/**
 * Right pane of the Skills page: the create form, the "Select a skill" hint,
 * loading / not-found states, or the selected skill's detail — one early
 * return per state.
 */
export function SkillsMain({
  create,
  selectedId,
  selected,
  tab,
  onTab,
}: {
  create: SkillsMainCreate;
  selectedId?: string;
  selected: Pick<UseQueryResult<Skill>, "data" | "isLoading" | "isError" | "refetch">;
  tab: string;
  /** Switch tab (`next`) or, with `null`, leave the detail after a delete. */
  onTab: (id: string | null, next?: string) => void;
}) {
  const t = useTranslations("skills");

  if (create.active) {
    return (
      <div style={s.mainScroll}>
        <SkillForm
          mode="create"
          initial={EMPTY_SKILL}
          submit={{ pending: create.pending }}
          onSubmit={create.onSubmit}
          onCancel={create.onCancel}
        />
      </div>
    );
  }
  if (!selectedId) {
    return (
      <div style={s.selectPrompt}>
        <div style={s.selectPromptTitle}>{t("page.selectPrompt.title")}</div>
        <div style={s.selectPromptBody}>{t("page.selectPrompt.body")}</div>
      </div>
    );
  }
  if (selected.isLoading) {
    return (
      <div style={s.mainScroll}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  }
  const skill = selected.data;
  if (selected.isError || !skill) {
    return (
      <div style={s.mainScroll}>
        <ErrorState
          title={t("detail.notFound.title")}
          body={t("detail.notFound.body")}
          onRetry={() => void selected.refetch()}
        />
      </div>
    );
  }
  return (
    <SkillDetail
      skill={skill}
      tab={tab}
      onTab={(next) => onTab(skill.id, next)}
      onDeleted={() => onTab(null)}
    />
  );
}
