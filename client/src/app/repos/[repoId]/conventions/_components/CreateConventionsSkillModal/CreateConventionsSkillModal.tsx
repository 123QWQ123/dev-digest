"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Modal } from "@devdigest/ui";
import type { ConventionCandidate, Skill } from "@devdigest/shared";
import { SkillForm, type SkillFormValues } from "@/components/skills";
import { useCreateConventionSkill } from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { buildSkillDraft, defaultSkillName, repoShortName } from "../../helpers";
import { s } from "./styles";

const CONVENTION_ONLY = ["convention"] as const;

/**
 * "Create skill from conventions": the accepted candidates merged into one
 * drafted `convention` skill. Name, description, body and enabled are editable;
 * nothing is saved until "Create skill".
 */
export function CreateConventionsSkillModal({
  repoId,
  repoFullName,
  accepted,
  onClose,
  onCreated,
}: {
  repoId: string;
  repoFullName: string;
  accepted: ConventionCandidate[];
  onClose: () => void;
  onCreated: (skill: Skill) => void;
}) {
  const t = useTranslations("conventions.modal");
  const toast = useToast();
  const create = useCreateConventionSkill(repoId);
  const repo = repoShortName(repoFullName);

  // Drafted once per open — the form owns the edits afterwards. Errors (e.g. 409 name
  // taken) are toasted globally by MutationCache, and the modal stays open.
  const [initial] = React.useState<SkillFormValues>(() => {
    const name = defaultSkillName(repoFullName);
    const draft = buildSkillDraft(name, accepted, {
      intro: t("draftIntro", { repo }),
      detected: t("draftDetected"),
      description: t("draftDescription", { count: accepted.length, repo }),
    });
    return { ...draft, type: "convention", enabled: true, note: "" };
  });

  const submit = (v: SkillFormValues) =>
    create.mutate(
      { name: v.name, description: v.description, body: v.body, enabled: v.enabled },
      {
        onSuccess: (skill) => {
          toast.success(t("created", { name: skill.name }));
          onCreated(skill);
        },
      },
    );

  return (
    <Modal width={760} title={t("title")} subtitle={<span className="mono">{initial.name}</span>} onClose={onClose}>
      <div style={s.body}>
        <div style={s.banner}>
          <Icon.Edit size={14} />
          <span>{t("banner", { count: accepted.length, repo })}</span>
        </div>
        <SkillForm
          initial={initial}
          mode="create"
          hideTitle
          types={CONVENTION_ONLY}
          submitting={create.isPending}
          submitLabel={t("submit")}
          onSubmit={submit}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}
