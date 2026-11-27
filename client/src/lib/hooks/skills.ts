/* hooks/skills.ts — React Query hooks for M2 Skills (Skills page + the agent
   editor's Skills tab). Invalidation lives here, never in pages. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AgentSkill,
  CreateSkillInput,
  SetAgentSkillsInput,
  Skill,
  SkillImportPreview,
  SkillStats,
  SkillVersion,
  UpdateSkillInput,
} from "@devdigest/shared";
import { queryKeys } from "./keys";

export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills(), queryFn: () => api.get<Skill[]>("/skills") });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.skill(id),
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.skillVersions(id),
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

/** Stats tab: 30-day pull rate, accept rate and findings of runs that used the skill. */
export function useSkillStats(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.skillStats(id),
    queryFn: () => api.get<SkillStats>(`/skills/${id}/stats`),
    enabled: !!id,
  });
}

/** A skill change can alter any agent's effective set / card count. */
function useInvalidateSkillViews() {
  const qc = useQueryClient();
  return (skill?: Skill) => {
    qc.invalidateQueries({ queryKey: queryKeys.skills() });
    qc.invalidateQueries({ queryKey: queryKeys.agentSkillsAll() });
    qc.invalidateQueries({ queryKey: queryKeys.agents() });
    if (skill) {
      qc.setQueryData(queryKeys.skill(skill.id), skill);
      qc.invalidateQueries({ queryKey: queryKeys.skillVersions(skill.id) });
    }
  };
}

export function useCreateSkill() {
  const invalidate = useInvalidateSkillViews();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: (skill) => invalidate(skill),
  });
}

export interface UpdateSkillArgs {
  id: string;
  patch: UpdateSkillInput;
}

export function useUpdateSkill() {
  const invalidate = useInvalidateSkillViews();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillArgs) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (skill) => invalidate(skill),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  const invalidate = useInvalidateSkillViews();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      invalidate();
      qc.removeQueries({ queryKey: queryKeys.skill(id) });
    },
  });
}

export function useRestoreSkillVersion() {
  const invalidate = useInvalidateSkillViews();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (skill) => invalidate(skill),
  });
}

/** Server-side parse of an uploaded .md / .zip. Persists nothing. */
export function useImportSkillPreview() {
  return useMutation({
    mutationFn: ({ filename, contentBase64 }: { filename: string; contentBase64: string }) =>
      api.post<SkillImportPreview>("/skills/import/preview", {
        filename,
        content_base64: contentBase64,
      }),
  });
}

export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.agentSkills(agentId),
    queryFn: () => api.get<AgentSkill[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/**
 * Replace an agent's ordered link set. Optimistic: the Skills tab reorders /
 * toggles instantly and rolls back if the server rejects the change.
 */
export function useSetAgentSkills(agentId: string) {
  const qc = useQueryClient();
  const key = queryKeys.agentSkills(agentId);
  return useMutation({
    mutationFn: (input: SetAgentSkillsInput & { optimistic: AgentSkill[] }) =>
      api.put<AgentSkill[]>(`/agents/${agentId}/skills`, { items: input.items }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AgentSkill[]>(key);
      qc.setQueryData(key, input.optimistic);
      return { previous };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      qc.invalidateQueries({ queryKey: queryKeys.agents() });
      qc.invalidateQueries({ queryKey: queryKeys.agent(agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.skills() });
    },
  });
}
