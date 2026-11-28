"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, SelectInput, TextInput, Toggle } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { PromptEditor } from "@/components/prompt-editor";
import { SKILL_BODY_MAX, SKILL_TYPES } from "../constants";
import { isValidSkill } from "./helpers";
import { SkillFormTitle } from "./SkillFormTitle";
import type { SkillFormSubmit, SkillFormValues } from "./types";
import { s } from "./styles";

/**
 * Skill editor form — shared by "Create skill" and the detail Config tab.
 * Seeded once from `initial`; the parent remounts it (`key`) to reset.
 */
export function SkillForm({
  initial,
  mode,
  onSubmit,
  onCancel,
  header,
  types = SKILL_TYPES,
  submit = {},
}: {
  initial: SkillFormValues;
  mode: "create" | "edit";
  onSubmit: (values: SkillFormValues) => void;
  onCancel?: () => void;
  /** Heading slot: omitted → the default title for `mode`; `null` → none (e.g. inside a Modal). */
  header?: React.ReactNode;
  /** Selectable types (e.g. only `convention` for an extracted skill). */
  types?: readonly SkillType[];
  submit?: SkillFormSubmit;
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
        {header === undefined ? (
          <SkillFormTitle title={mode === "create" ? t("form.createTitle") : t("form.title")} />
        ) : (
          header
        )}
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
      {submit.extra}
      <div style={s.actions}>
        <Button
          kind="primary"
          icon="Check"
          onClick={() => onSubmit(v)}
          disabled={!valid || submit.pending || submit.blocked}
        >
          {submit.pending
            ? t("form.saving")
            : (submit.label ?? (mode === "create" ? t("form.create") : t("form.save")))}
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
