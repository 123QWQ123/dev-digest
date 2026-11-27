"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { isUntrusted } from "../../helpers";
import { s } from "./styles";

/** Skill body rendered as markdown inside a card — the text the reviewing agent gets. */
export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.hint}>{t("preview.hint")}</p>
      {isUntrusted(skill) && <div style={s.notice}>{t("preview.untrustedNotice")}</div>}
      <div className="skill-prose" style={s.card} data-testid="skill-preview">
        {skill.body ? <Markdown>{skill.body}</Markdown> : <p style={s.empty}>{t("preview.empty")}</p>}
      </div>
    </div>
  );
}
