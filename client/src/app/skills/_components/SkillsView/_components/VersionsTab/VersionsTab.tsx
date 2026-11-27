"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { lineDiff } from "../../helpers";
import { s } from "./styles";

/** Version history: every content save is an immutable snapshot; Restore appends a new one. */
export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const versions = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffOf, setDiffOf] = React.useState<SkillVersion | null>(null);

  if (versions.isLoading) return <Skeleton height={160} />;
  if (versions.isError) return <ErrorState body={t("versions.loadError")} onRetry={() => versions.refetch()} />;
  const list = versions.data ?? [];

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        <Badge color="var(--accent)" bg="var(--accent-bg)">
          {t("versions.count", { count: list.length })}
        </Badge>
      </div>
      <p style={s.hint}>{t("versions.hint")}</p>
      <div style={s.list}>
        {list.map((v) => {
          const current = v.version === skill.version;
          return (
            <div key={v.version} style={s.row} data-testid={`skill-version-${v.version}`}>
              <span className="mono" style={s.vBadge}>
                v{v.version}
              </span>
              <div style={s.rowText}>
                <div style={s.note}>{v.note || t("versions.noNote")}</div>
                <div style={s.date}>{new Date(v.created_at).toLocaleString()}</div>
              </div>
              {current ? (
                <Badge color="var(--ok)" dot>
                  {t("versions.current")}
                </Badge>
              ) : (
                <>
                  <Button kind="secondary" size="sm" icon="Eye" onClick={() => setDiffOf(v)}>
                    {t("versions.diff")}
                  </Button>
                  <Button
                    kind="secondary"
                    size="sm"
                    icon="History"
                    disabled={restore.isPending}
                    onClick={() =>
                      restore.mutate(
                        { id: skill.id, version: v.version },
                        {
                          onSuccess: (sk) =>
                            toast.success(t("versions.restoredToast", { from: v.version, version: sk.version })),
                        },
                      )
                    }
                  >
                    {t("versions.restore")}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {diffOf && (
        <Modal
          width={820}
          title={t("versions.diffTitle", { from: diffOf.version, to: skill.version })}
          onClose={() => setDiffOf(null)}
          footer={
            <Button kind="secondary" onClick={() => setDiffOf(null)}>
              {t("versions.close")}
            </Button>
          }
        >
          <pre className="mono" style={s.diff}>
            {lineDiff(diffOf.body, skill.body).map((l, i) => (
              <div key={i} style={s.diffLine(l.kind)}>
                {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
                {l.text}
              </div>
            ))}
          </pre>
        </Modal>
      )}
    </div>
  );
}
