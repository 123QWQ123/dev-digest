"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, SelectInput, TextInput, Toggle } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { PromptEditor } from "@/components/prompt-editor";
import { SKILL_BODY_MAX, SKILL_NAME_RE, SKILL_TYPES } from "../constants";
import { s } from "./styles";

export interface SkillFormValues {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  note: string;
}

export const EMPTY_SKILL: SkillFormValues = {
  name: "",
  description: "",
  type: "custom",
  body: "",
  enabled: true,
  note: "",
};

export function isValidSkill(v: SkillFormValues): boolean {
  return (
    SKILL_NAME_RE.test(v.name) &&
    v.description.trim().length > 0 &&
    v.body.trim().length > 0 &&
    v.body.length <= SKILL_BODY_MAX
  );
}

/**
 * Skill editor form — shared by "Create skill" and the detail Config tab.
 * Seeded once from `initial`; the parent remounts it (`key`) to reset.
 */
export function SkillForm({
  initial,
  mode,
  submitting,
  onSubmit,
  onCancel,
  title,
  beforeActions,
  submitBlocked = false,
  submitLabel,
  version,
  types = SKILL_TYPES,
  hideTitle = false,
}: {
  initial: SkillFormValues;
  mode: "create" | "edit";
  submitting: boolean;
  onSubmit: (values: SkillFormValues) => void;
  onCancel?: () => void;
  title?: React.ReactNode;
  /** Rendered above the buttons (e.g. the import trust confirmation). */
  beforeActions?: React.ReactNode;
  /** Extra gate on submit besides validity (e.g. "I trust this skill"). */
  submitBlocked?: boolean;
  submitLabel?: string;
  /** Current version, shown next to the title in edit mode. */
  version?: number;
  /** Selectable types (e.g. only `convention` for an extracted skill). */
  types?: readonly SkillType[];
  /** Hide the heading when a container (modal) already shows one. */
  hideTitle?: boolean;
}) {
  const t = useTranslations("skills");
  const [v, setV] = React.useState(initial);
  const set = <K extends keyof SkillFormValues>(k: K) => (value: SkillFormValues[K]) =>
    setV((cur) => ({ ...cur, [k]: value }));
  const valid = isValidSkill(v);
  const bodyDirty = v.body !== initial.body;
  const typeOptions = types.map((ty) => ({ value: ty, label: t(`type.${ty}`) }));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.titleGroup}>
          {!hideTitle && <h2 style={s.h2}>{title ?? (mode === "create" ? t("form.createTitle") : t("form.title"))}</h2>}
          {version != null && (
            <Badge color="var(--text-secondary)" icon="GitCommit" mono>
              v{version}
            </Badge>
          )}
        </div>
        <label style={s.enabledLabel}>
          {t("form.enabled")}
          <Toggle on={v.enabled} onChange={set("enabled")} size={16} />
        </label>
      </div>
      <FormField label={t("form.name")} hint={t("form.nameHint")} required>
        <TextInput
          value={v.name}
          onChange={set("name")}
          placeholder={t("form.namePlaceholder")}
          aria-label={t("form.name")}
          mono
        />
      </FormField>
      <FormField label={t("form.description")} hint={t("form.descriptionHint")} required>
        <TextInput
          value={v.description}
          onChange={set("description")}
          placeholder={t("form.descriptionPlaceholder")}
          aria-label={t("form.description")}
        />
      </FormField>
      <FormField label={t("form.type")}>
        <SelectInput value={v.type} onChange={(x) => set("type")(x as SkillType)} options={typeOptions} />
      </FormField>
      <FormField
        label={t("form.body")}
        hint={t("form.bodyHint")}
        required
        right={
          <span style={s.counter(v.body.length > SKILL_BODY_MAX)}>
            {t("form.chars", { count: v.body.length, max: SKILL_BODY_MAX })}
          </span>
        }
      >
        <PromptEditor
          value={v.body}
          onChange={set("body")}
          fileName={`${v.name || "skill"}.md`}
          dirty={bodyDirty}
          ariaLabel={t("form.body")}
        />
      </FormField>
      {mode === "edit" && (
        <FormField label={t("form.note")}>
          <TextInput value={v.note} onChange={set("note")} placeholder={t("form.notePlaceholder")} />
        </FormField>
      )}
      {beforeActions}
      <div style={s.actions}>
        <Button
          kind="primary"
          icon="Check"
          onClick={() => onSubmit(v)}
          disabled={!valid || submitting || submitBlocked}
        >
          {submitting
            ? t("form.saving")
            : (submitLabel ?? (mode === "create" ? t("form.create") : t("form.save")))}
        </Button>
        {onCancel && (
          <Button kind="secondary" onClick={onCancel}>
            {t("form.cancel")}
          </Button>
        )}
        {!valid && <span style={s.invalid}>{t("form.invalid")}</span>}
      </div>
    </div>
  );
}
