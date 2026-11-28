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
import { useCreateSkill, useDeleteSkill, useSkill, useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { DETAIL_TAB_KEYS } from "./constants";
import { filterSkills } from "./helpers";
import { SkillCard } from "./_components/SkillCard";
import { SkillsMain } from "./_components/SkillsMain";
import type { SkillFormValues } from "@/components/skills";
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
  const del = useDeleteSkill();
  // Local on purpose (like the PR list): router.replace on every keystroke lags the input.
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

  const remove = (id: string, name: string) => {
    if (!window.confirm(t("detail.deleteConfirm", { name }))) return;
    del.mutate(id, {
      onSuccess: () => {
        toast.success(t("detail.deleted"));
        if (id === selectedId) router.push("/skills");
      },
    });
  };

  const list = filterSkills(skills ?? [], query);
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    ...(selected.data ? [{ label: selected.data.name }] : []),
  ];

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
                onDelete={() => remove(sk.id, sk.name)}
              />
            ))}
          </div>
        </div>
        <div style={s.main}>
          <SkillsMain
            create={{
              active: creating,
              pending: create.isPending,
              onSubmit: submitCreate,
              onCancel: () => setCreating(false),
            }}
            selectedId={selectedId}
            selected={selected}
            tab={tab}
            onTab={(id, next) => (id ? open(id, next) : router.push("/skills"))}
          />
        </div>
      </div>
    </AppShell>
  );
}
