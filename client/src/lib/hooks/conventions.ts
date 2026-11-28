/* hooks/conventions.ts — React Query hooks for the M2 Conventions Extractor
   (per-repo candidates, extraction, accept/reject/edit, save as skill).
   Invalidation lives here, never in pages. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  ConventionCandidate,
  ConventionList,
  CreateConventionSkillInput,
  ExtractConventionsResult,
  Skill,
  UpdateConventionInput,
} from "@devdigest/shared";
import { queryKeys } from "./keys";

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.conventions(repoId),
    queryFn: () => api.get<ConventionList>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

/** Run (or re-run) extraction. Synchronous on the server; the result replaces the list. */
export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ExtractConventionsResult>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (res) => {
      const list: ConventionList = { items: res.items, last_scan_at: res.last_scan_at };
      qc.setQueryData(queryKeys.conventions(repoId), list);
    },
  });
}

export interface UpdateConventionArgs {
  id: string;
  patch: UpdateConventionInput;
}

/** Accept / reject / edit one candidate — optimistic, rolled back on error. */
export function useUpdateConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  const key = queryKeys.conventions(repoId);
  const patchItem = (id: string, fn: (c: ConventionCandidate) => ConventionCandidate) =>
    qc.setQueryData<ConventionList>(key, (cur) =>
      cur ? { ...cur, items: cur.items.map((c) => (c.id === id ? fn(c) : c)) } : cur,
    );
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionArgs) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ConventionList>(key);
      patchItem(id, (c) => ({ ...c, ...patch }));
      return { prev };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (row) => patchItem(row.id, () => row),
  });
}

/** Save the accepted candidates as one `convention` skill. */
export function useCreateConventionSkill(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: (skill) => {
      qc.invalidateQueries({ queryKey: queryKeys.skills() });
      qc.setQueryData(queryKeys.skill(skill.id), skill);
    },
  });
}
