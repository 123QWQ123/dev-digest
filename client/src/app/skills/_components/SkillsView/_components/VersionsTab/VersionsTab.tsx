"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { lineDiff } from "../../helpers";
import { s } from "./styles";

/**
 * Version history: every content save is an immutable snapshot. Restore switches the
 * skill to a snapshot (no new entry). Diff shows what a version changed relative to the
 * version just below it; the oldest one diffs against an empty body (all lines added).
 */
export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const versions = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  // `from: null` = the oldest version, compared with an empty body.
  const [diff, setDiff] = React.useState<{ from: SkillVersion | null; to: SkillVersion } | null>(null);

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
        {list.map((v, i) => {
          const current = v.version === skill.version;
          // Newest-first list, so the next row is the version just below this one.
          const previous = list[i + 1];
          return (
            <div key={v.version} style={s.row} data-testid={`skill-version-${v.version}`}>
              <span className="mono" style={s.vBadge}>
                v{v.version}
              </span>
              <div style={s.rowText}>
                <div style={s.note}>{v.note || t("versions.noNote", { version: v.version })}</div>
                <div style={s.date}>{new Date(v.created_at).toLocaleString()}</div>
              </div>
              {current && (
                <Badge color="var(--ok)" dot>
                  {t("versions.current")}
                </Badge>
              )}
              <Button kind="secondary" size="sm" icon="Eye" onClick={() => setDiff({ from: previous ?? null, to: v })}>
                {t("versions.diff")}
              </Button>
              {!current && (
                <Button
                  kind="secondary"
                  size="sm"
                  icon="History"
                  disabled={restore.isPending}
                  onClick={() =>
                    restore.mutate(
                      { id: skill.id, version: v.version },
                      {
                        onSuccess: (sk) => toast.success(t("versions.restoredToast", { version: sk.version })),
                      },
                    )
                  }
                >
                  {t("versions.restore")}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {diff && (
        <Modal
          width={820}
          title={
            diff.from
              ? t("versions.diffTitle", { from: diff.from.version, to: diff.to.version })
              : t("versions.diffInitialTitle", { to: diff.to.version })
          }
          onClose={() => setDiff(null)}
          footer={
            <Button kind="secondary" onClick={() => setDiff(null)}>
              {t("versions.close")}
            </Button>
          }
        >
          <pre className="mono" style={s.diff}>
            {lineDiff(diff.from?.body ?? "", diff.to.body).map((l, i) => (
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
