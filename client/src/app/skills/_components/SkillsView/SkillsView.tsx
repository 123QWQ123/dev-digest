/* /skills — Skills Lab → Skills. Left: searchable skill cards + "Add Skill"
   (create / import). Right: the selected skill's Config / Preview / Versions,
   the create form, or a select prompt. Selection lives in the URL
   (/skills/:id?tab=…). */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useCreateSkill, useSkill, useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { DETAIL_TAB_KEYS } from "./constants";
import { filterSkills } from "./helpers";
import { SkillCard } from "./_components/SkillCard";
import { SkillDetail } from "./_components/SkillDetail";
import { SkillForm, EMPTY_SKILL, type SkillFormValues } from "@/components/skills";
import { ImportSkillDrawer } from "./_components/ImportSkillDrawer";
import { s } from "./styles";

export function SkillsView({ selectedId }: { selectedId?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const selected = useSkill(selectedId);
  const update = useUpdateSkill();
  const create = useCreateSkill();
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const tabParam = search.get("tab") ?? "";
  const tab = DETAIL_TAB_KEYS.includes(tabParam) ? tabParam : "config";
  const open = (id: string, nextTab = tab) => {
    setCreating(false);
    router.push(`/skills/${id}?tab=${nextTab}`);
  };

  const submitCreate = (v: SkillFormValues) =>
    create.mutate(
      { name: v.name, description: v.description, type: v.type, body: v.body, enabled: v.enabled },
      {
        onSuccess: (skill) => {
          toast.success(t("form.createdToast", { name: skill.name }));
          open(skill.id, "config");
        },
      },
    );

  const list = filterSkills(skills ?? [], query);
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    ...(selected.data ? [{ label: selected.data.name }] : []),
  ];

  const detail = () => {
    if (creating) {
      return (
        <div style={s.mainScroll}>
          <SkillForm
            mode="create"
            initial={EMPTY_SKILL}
            submitting={create.isPending}
            onSubmit={submitCreate}
            onCancel={() => setCreating(false)}
          />
        </div>
      );
    }
    if (!selectedId) {
      return (
        <div style={s.mainScroll}>
          <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
        </div>
      );
    }
    if (selected.isLoading) {
      return (
        <div style={s.mainScroll}>
          <Skeleton height={24} width={240} />
          <Skeleton height={200} />
        </div>
      );
    }
    if (selected.isError || !selected.data) {
      return (
        <div style={s.mainScroll}>
          <ErrorState title={t("detail.notFound.title")} body={t("detail.notFound.body")} onRetry={() => selected.refetch()} />
        </div>
      );
    }
    return (
      <SkillDetail
        skill={selected.data}
        tab={tab}
        onTab={(next) => open(selected.data!.id, next)}
        onDeleted={() => router.push("/skills")}
      />
    );
  };

  return (
    <AppShell crumb={crumb}>
      {importing && (
        <ImportSkillDrawer
          onClose={() => setImporting(false)}
          onSaved={(skill) => {
            setImporting(false);
            open(skill.id, "preview");
          }}
        />
      )}
      <div style={s.layout}>
        <div style={s.sidebar}>
          <div style={s.sidebarHead}>
            <div style={s.titleRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <Dropdown
                width={240}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                    {t("page.addSkill")}
                  </Button>
                }
                items={[
                  { label: t("page.menu.create"), icon: "Edit", onClick: () => setCreating(true) },
                  { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setImporting(true) },
                ]}
              />
            </div>
            <div style={s.search}>
              <Icon.Search size={13} style={{ color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                aria-label={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>
          <div style={s.list}>
            {isLoading && (
              <>
                <Skeleton height={100} />
                <Skeleton height={100} />
              </>
            )}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {!isLoading && !isError && (skills ?? []).length === 0 && (
              <EmptyState
                icon="Sparkles"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => setCreating(true)}
              />
            )}
            {!isLoading && (skills ?? []).length > 0 && list.length === 0 && (
              <p style={s.muted}>{t("page.noMatch")}</p>
            )}
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === selectedId && !creating}
                onClick={() => open(sk.id)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        </div>
        <div style={s.main}>{detail()}</div>
      </div>
    </AppShell>
  );
}
