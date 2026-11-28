"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, IconBtn, ProgressBar, Textarea } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { CONVENTION_RULE_MAX } from "../../constants";
import { confidenceColor, evidenceRef } from "../../helpers";
import { s } from "./styles";

const COPIED_MS = 1200;

/**
 * One extracted convention: the rule (editable), its evidence from real code,
 * the model's confidence, and Accept / Reject.
 */
export function ConventionCard({
  candidate: c,
  onSetAccepted,
  onSaveRule,
}: {
  candidate: ConventionCandidate;
  onSetAccepted: (accepted: boolean) => void;
  onSaveRule: (rule: string) => void;
}) {
  const t = useTranslations("conventions.card");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c.rule);
  const [copied, setCopied] = React.useState(false);
  const pct = Math.round(c.confidence * 100);
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= CONVENTION_RULE_MAX && trimmed !== c.rule;

  const startEdit = () => {
    setDraft(c.rule);
    setEditing(true);
  };
  const save = () => {
    if (canSave) onSaveRule(trimmed);
    setEditing(false);
  };
  const copy = () => {
    void navigator.clipboard?.writeText(c.evidence_snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <article style={s.card(c.accepted)} data-testid="convention-card">
      <div style={s.main}>
        {editing ? (
          <div>
            <Textarea value={draft} onChange={setDraft} rows={2} placeholder={t("ruleLabel")} />
            <div style={s.editActions}>
              <Button kind="primary" size="sm" icon="Check" onClick={save} disabled={!canSave}>
                {t("save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.ruleRow}>
            <h3 style={s.rule}>{c.rule}</h3>
            <IconBtn icon="Edit" label={t("edit")} size={26} onClick={startEdit} />
          </div>
        )}

        {c.evidence_path && (
          <div style={s.evidence}>
            <div style={s.evidenceHead}>
              <span className="mono">{evidenceRef(c)}</span>
              <button type="button" style={s.copyBtn} onClick={copy} aria-label={copied ? t("copied") : t("copy")}>
                {copied ? <Icon.Check size={12} /> : <Icon.Copy size={12} />}
              </button>
            </div>
            <pre className="mono" style={s.snippet}>
              {c.evidence_snippet}
            </pre>
          </div>
        )}

        <div style={s.confidence}>
          <span>{t("confidence")}</span>
          <div style={s.bar}>
            <ProgressBar value={pct} color={confidenceColor(c.confidence)} height={5} />
          </div>
          <span className="mono tnum">{pct}%</span>
        </div>
      </div>

      <div style={s.side}>
        <Button
          kind={c.accepted ? "primary" : "secondary"}
          size="sm"
          icon="Check"
          full
          active={c.accepted}
          onClick={() => onSetAccepted(true)}
          aria-pressed={c.accepted}
        >
          {c.accepted ? t("accepted") : t("accept")}
        </Button>
        <Button
          kind="ghost"
          size="sm"
          icon="X"
          full
          onClick={() => onSetAccepted(false)}
          disabled={!c.accepted}
        >
          {t("reject")}
        </Button>
      </div>
    </article>
  );
}
