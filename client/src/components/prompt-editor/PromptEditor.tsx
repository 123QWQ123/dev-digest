/* PromptEditor — mono text editor for prompt text (skill body, agent system
   prompt): a file-style header (name · unsaved · token count) and a
   line-number gutter kept in scroll-sync with the textarea. Text only. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { useTokenCount } from "@/lib/hooks/tokens";
import { lineNumbers } from "./helpers";
import { s } from "./styles";

export function PromptEditor({
  value,
  onChange,
  fileName,
  dirty,
  tokenBudget,
  rows = 18,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  fileName: string;
  dirty?: boolean;
  /** Soft budget shown as "N / budget tokens" and coloured when exceeded. */
  tokenBudget?: number;
  rows?: number;
  ariaLabel?: string;
}) {
  const t = useTranslations("common.promptEditor");
  const gutter = React.useRef<HTMLDivElement>(null);
  const { data } = useTokenCount(value);
  const tokens = data?.tokens;
  const over = tokenBudget != null && tokens != null && tokens > tokenBudget;

  return (
    <div style={s.frame}>
      <div style={s.head}>
        <Icon.FileText size={13} />
        <span className="mono" style={s.fileName}>
          {fileName}
        </span>
        {dirty && <span style={s.unsaved}>{t("unsaved")}</span>}
        <span className="mono tnum" style={s.tokens(over)} data-testid="prompt-tokens">
          {tokens == null
            ? t("counting")
            : tokenBudget != null
              ? t("tokensOfBudget", { count: tokens.toLocaleString("en-US"), budget: tokenBudget.toLocaleString("en-US") })
              : t("tokens", { count: tokens.toLocaleString("en-US") })}
        </span>
      </div>
      <div style={s.body(rows)}>
        <div ref={gutter} style={s.gutter} aria-hidden>
          {lineNumbers(value).map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          className="mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
          }}
          wrap="off"
          spellCheck={false}
          aria-label={ariaLabel ?? fileName}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
