"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import {
  useConventions,
  useExtractConventions,
  useUpdateConvention,
} from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { formatCost } from "@/components/run-cost";
import { bodyStatus, repoShortName } from "../../helpers";
import { s } from "../../styles";
import { ConventionsBody } from "./_components/ConventionsBody";
import type { ConventionPatch } from "./_components/ConventionsList";
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

  const patch = (c: ConventionCandidate, p: ConventionPatch) => update.mutate({ id: c.id, patch: p });

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

      <ConventionsBody
        status={bodyStatus(isLoading, isError)}
        items={items}
        cloned={cloned}
        scanning={scanning}
        actions={{ retry: () => void refetch(), run: runExtraction, patch, createSkill: () => setModalOpen(true) }}
      />

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

