"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { s } from "@/app/repos/[repoId]/conventions/styles";
import { ConventionCard } from "@/app/repos/[repoId]/conventions/_components/ConventionCard";

export type ConventionPatch = { accepted?: boolean; rule?: string };

/** Toolbar (accept all / deselect all, count, Create skill) and the candidate cards. */
export function ConventionsList({
  items,
  onPatch,
  onCreateSkill,
}: {
  items: ConventionCandidate[];
  onPatch: (c: ConventionCandidate, patch: ConventionPatch) => void;
  onCreateSkill: () => void;
}) {
  const t = useTranslations("conventions.page");
  const acceptedCount = items.filter((c) => c.accepted).length;
  const allAccepted = acceptedCount === items.length;

  const setAll = (value: boolean) => {
    for (const c of items) if (c.accepted !== value) onPatch(c, { accepted: value });
  };

  return (
    <>
      <div style={s.toolbar}>
        <Button kind="secondary" size="sm" icon={allAccepted ? "X" : "Check"} onClick={() => setAll(!allAccepted)}>
          {allAccepted ? t("deselectAll") : t("acceptAll")}
        </Button>
        <span style={s.count}>{t("acceptedCount", { accepted: acceptedCount, total: items.length })}</span>
        <span style={s.spacer} />
        <Button kind="primary" icon="Sparkles" disabled={acceptedCount === 0} onClick={onCreateSkill}>
          {t("createSkill")}
        </Button>
      </div>
      <div style={s.list}>
        {items.map((c) => (
          <ConventionCard
            key={c.id}
            candidate={c}
            onSetAccepted={(value) => c.accepted !== value && onPatch(c, { accepted: value })}
            onSaveRule={(rule) => onPatch(c, { rule })}
          />
        ))}
      </div>
    </>
  );
}
