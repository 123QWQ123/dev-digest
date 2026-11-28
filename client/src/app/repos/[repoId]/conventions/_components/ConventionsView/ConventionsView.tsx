"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import {
  useConventions,
  useExtractConventions,
  useUpdateConvention,
} from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { formatCost } from "@/components/run-cost";
import { SKELETON_CARDS } from "../../constants";
import { repoShortName } from "../../helpers";
import { s } from "../../styles";
import { ConventionCard } from "../ConventionCard";
import { CreateConventionsSkillModal } from "../CreateConventionsSkillModal";

/**
 * The Conventions page body: header, toolbar, candidate cards, create-skill modal.
 * Mutation errors are toasted globally (MutationCache in lib/providers.tsx) — no local onError.
 */
export function ConventionsView({
  repoId,
  repoFullName,
  cloned,
}: {
  repoId: string;
  repoFullName: string;
  /** false = the repo has no local checkout, so extraction can't run. */
  cloned: boolean;
}) {
  const t = useTranslations("conventions");
  const format = useFormatter();
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [modalOpen, setModalOpen] = React.useState(false);

  const items = data?.items ?? [];
  const accepted = items.filter((c) => c.accepted);
  const scanning = extract.isPending;

  const runExtraction = () =>
    extract.mutate(undefined, {
      onSuccess: (res) =>
        toast.success(
          t("page.scanDone", {
            kept: res.kept,
            files: res.sampled_files,
            dropped: res.dropped,
            cost: res.cost_usd == null ? t("page.costUnknown") : formatCost(res.cost_usd),
            model: res.model,
          }),
        ),
    });

  const patch = (c: ConventionCandidate, p: { accepted?: boolean; rule?: string }) =>
    update.mutate({ id: c.id, patch: p });

  const setAll = (value: boolean) => {
    for (const c of items) if (c.accepted !== value) patch(c, { accepted: value });
  };

  const subtitle = data?.last_scan_at
    ? `${t("page.candidateCount", { count: items.length })} · ${t("page.lastScan", {
        ago: format.relativeTime(new Date(data.last_scan_at)),
      })}`
    : t("page.subtitle");

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>
            {t("page.headingPrefix")}
            <span className="mono" style={s.repo}>
              {repoShortName(repoFullName)}
            </span>
          </h1>
          <p style={s.subtitle}>{subtitle}</p>
        </div>
        {items.length > 0 && (
          <div style={s.headerActions}>
            <Button
              kind="secondary"
              icon="RefreshCw"
              onClick={runExtraction}
              loading={scanning}
              disabled={scanning || !cloned}
            >
              {scanning ? t("page.scanning") : t("page.rescan")}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={s.list}>
          {Array.from({ length: SKELETON_CARDS }, (_, i) => (
            <Skeleton key={i} height={150} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState body={t("page.loadError")} onRetry={() => void refetch()} />
      ) : items.length === 0 && !cloned ? (
        <EmptyState icon="GitBranch" title={t("page.notCloned.title")} body={t("page.notCloned.body")} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="ListChecks"
          title={t("page.empty.title")}
          body={t("page.empty.body")}
          cta={scanning ? t("page.scanning") : t("page.empty.cta")}
          onCta={runExtraction}
          ctaLoading={scanning}
        />
      ) : (
        <>
          <div style={s.toolbar}>
            {accepted.length === items.length ? (
              <Button kind="secondary" size="sm" icon="X" onClick={() => setAll(false)}>
                {t("page.deselectAll")}
              </Button>
            ) : (
              <Button kind="secondary" size="sm" icon="Check" onClick={() => setAll(true)}>
                {t("page.acceptAll")}
              </Button>
            )}
            <span style={s.count}>
              {t("page.acceptedCount", { accepted: accepted.length, total: items.length })}
            </span>
            <span style={s.spacer} />
            <Button kind="primary" icon="Sparkles" disabled={accepted.length === 0} onClick={() => setModalOpen(true)}>
              {t("page.createSkill")}
            </Button>
          </div>
          <div style={s.list}>
            {items.map((c) => (
              <ConventionCard
                key={c.id}
                candidate={c}
                onSetAccepted={(value) => c.accepted !== value && patch(c, { accepted: value })}
                onSaveRule={(rule) => patch(c, { rule })}
              />
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <CreateConventionsSkillModal
          repoId={repoId}
          repoFullName={repoFullName}
          accepted={accepted}
          onClose={() => setModalOpen(false)}
          onCreated={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
