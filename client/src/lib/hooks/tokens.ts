/* hooks/tokens.ts — live token count for the prompt editors (skill body,
   agent system prompt). Server-side tiktoken (same encoder as the run trace's
   prompt_tokens) — the client never ships the multi-MB BPE ranks. */
"use client";

import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { TokenCount } from "@devdigest/shared";
import { api } from "../api";
import { queryKeys } from "./keys";

/** Typing pause before a recount. */
const DEBOUNCE_MS = 400;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Token count of `text`; keeps the previous number while a recount is in flight. */
export function useTokenCount(text: string) {
  const debounced = useDebounced(text, DEBOUNCE_MS);
  return useQuery({
    queryKey: queryKeys.tokenCount(debounced),
    queryFn: () => api.post<TokenCount>("/tokens/count", { text: debounced }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });
}
