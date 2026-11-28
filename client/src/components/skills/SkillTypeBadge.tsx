/* SkillTypeBadge — coloured type chip shared by the Skills page and the agent
   editor's Skills tab (cross-route, so it lives in src/components). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "var(--ok)",
  security: "var(--crit)",
  custom: "var(--text-secondary)",
};

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  return (
    <Badge color={TYPE_COLOR[type]} mono>
      {t(`type.${type}`)}
    </Badge>
  );
}
