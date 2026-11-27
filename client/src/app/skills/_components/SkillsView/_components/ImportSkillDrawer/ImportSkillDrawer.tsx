"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Checkbox, Drawer, Icon } from "@devdigest/ui";
import type { Skill, SkillImportPreview } from "@devdigest/shared";
import { useCreateSkill, useImportSkillPreview } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { IMPORT_MAX_BYTES } from "../../constants";
import { fileToBase64 } from "../../helpers";
import { SkillForm, type SkillFormValues } from "../SkillForm";
import { s } from "./styles";

/**
 * Import flow: pick a .md / .zip → the SERVER extracts the skill core (only the
 * markdown; scripts and other files are listed as ignored, never run) → the
 * user reviews/edits the preview → nothing is saved until they confirm trust
 * and press Save.
 */
export function ImportSkillDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (skill: Skill) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const preview = useImportSkillPreview();
  const create = useCreateSkill();
  const [data, setData] = React.useState<SkillImportPreview | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [trusted, setTrusted] = React.useState(false);

  const onFile = async (file: File | undefined) => {
    setData(null);
    setTrusted(false);
    setLocalError(null);
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setLocalError(t("import.tooLarge"));
      return;
    }
    let contentBase64: string;
    try {
      contentBase64 = await fileToBase64(file);
    } catch {
      // FileReader failure (unreadable/removed file) — show it instead of an unhandled rejection.
      setLocalError(t("import.readError"));
      return;
    }
    preview.mutate({ filename: file.name, contentBase64 }, { onSuccess: setData });
  };

  const save = (v: SkillFormValues) =>
    create.mutate(
      {
        name: v.name,
        description: v.description,
        type: v.type,
        body: v.body,
        enabled: v.enabled,
        source: "imported",
      },
      {
        onSuccess: (skill) => {
          toast.success(t("import.savedToast", { name: skill.name }));
          onSaved(skill);
        },
      },
    );

  return (
    <Drawer width={760} title={t("import.title")} subtitle={t("import.subtitle")} onClose={onClose}>
      <label style={s.picker}>
        <Icon.Upload size={16} />
        <span>{t("import.choose")}</span>
        <input
          type="file"
          accept=".md,.markdown,.zip"
          aria-label={t("import.choose")}
          style={s.fileInput}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {preview.isPending && <p style={s.muted}>{t("import.parsing")}</p>}
      {localError && <p style={s.error}>{localError}</p>}

      {data && (
        <div style={s.result}>
          <p style={s.muted}>{t("import.sourceFile", { file: data.source_file })}</p>
          {data.ignored_files.length > 0 && (
            <div style={s.box}>
              <div style={s.boxTitle}>{t("import.ignored")}</div>
              <ul style={s.ul}>
                {data.ignored_files.map((f) => (
                  <li key={f} className="mono">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.warnings.length > 0 && (
            <div style={s.warnBox}>
              <div style={s.boxTitle}>{t("import.warnings")}</div>
              <ul style={s.ul}>
                {data.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <SkillForm
            key={data.source_file + data.name}
            mode="create"
            title={t("import.previewTitle")}
            submitting={create.isPending}
            submitBlocked={!trusted}
            submitLabel={t("import.save")}
            onCancel={onClose}
            initial={{
              name: data.name,
              description: data.description,
              type: data.type,
              body: data.body,
              enabled: true,
              note: "",
            }}
            onSubmit={save}
            beforeActions={
              <div style={s.trust}>
                <div style={s.boxTitle}>{t("import.trustTitle")}</div>
                <p style={s.trustBody}>{t("import.trustBody")}</p>
                <Checkbox checked={trusted} onChange={setTrusted} label={t("import.confirm")} />
              </div>
            }
          />
        </div>
      )}
    </Drawer>
  );
}
