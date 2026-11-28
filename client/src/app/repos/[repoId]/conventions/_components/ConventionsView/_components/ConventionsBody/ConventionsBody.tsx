"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { SKELETON_CARDS } from "@/app/repos/[repoId]/conventions/constants";
import type { BodyStatus } from "@/app/repos/[repoId]/conventions/helpers";
import { s } from "@/app/repos/[repoId]/conventions/styles";
import { ConventionsList, type ConventionPatch } from "../ConventionsList";

/**
 * Loading / error / not-cloned / empty / list — one early return per state
 * (no nested ternaries). Header and modal stay in ConventionsView.
 */
export function ConventionsBody({
  status,
  items,
  cloned,
  scanning,
  actions,
}: {
  status: BodyStatus;
  items: ConventionCandidate[];
  cloned: boolean;
  scanning: boolean;
  actions: {
    retry: () => void;
    run: () => void;
    patch: (c: ConventionCandidate, p: ConventionPatch) => void;
    createSkill: () => void;
  };
}) {
  const t = useTranslations("conventions.page");
  if (status === "loading") {
    return (
      <div style={s.list}>
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <Skeleton key={i} height={150} />
        ))}
      </div>
    );
  }
  if (status === "error") return <ErrorState body={t("loadError")} onRetry={actions.retry} />;
  if (items.length === 0 && !cloned) {
    return <EmptyState icon="GitBranch" title={t("notCloned.title")} body={t("notCloned.body")} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon="ListChecks"
        title={t("empty.title")}
        body={t("empty.body")}
        cta={scanning ? t("scanning") : t("empty.cta")}
        onCta={actions.run}
        ctaLoading={scanning}
      />
    );
  }
  return <ConventionsList items={items} onPatch={actions.patch} onCreateSkill={actions.createSkill} />;
}
