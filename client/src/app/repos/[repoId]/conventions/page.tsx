/* Conventions — /repos/:repoId/conventions (M2 Conventions Extractor).
   Scan the repo for house rules, accept/edit them, save them as one skill. */
"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ConventionsView } from "./_components/ConventionsView";

export default function ConventionsPage() {
  const t = useTranslations("conventions.page");
  const { repoId } = useParams<{ repoId: string }>();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const repoFullName = activeRepo?.full_name ?? t("repoFallback");
  // Unknown while repos load → let the server decide (it answers 422 repo_not_cloned).
  const cloned = activeRepo ? activeRepo.clone_path != null : true;
  const crumb = [{ label: t("crumbLab") }, { label: t("crumbConventions") }];

  return (
    <AppShell crumb={crumb}>
      {repoNotFound ? <RepoNotFound /> : <ConventionsView repoId={repoId} repoFullName={repoFullName} cloned={cloned} />}
    </AppShell>
  );
}
