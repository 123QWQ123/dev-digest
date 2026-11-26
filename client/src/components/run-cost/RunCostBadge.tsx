/* RunCostBadge — M1 run cost. `compact`: "$0.014"; `detailed`: "9 119 tok · $0.0013". */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { formatCost, formatTokenCount } from "./helpers";

const style: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" };

export function RunCostBadge({
  costUsd,
  tokens,
  variant = "compact",
}: {
  costUsd: number | null | undefined;
  /** Total tokens (in + out); used by the `detailed` variant only. */
  tokens?: number | null;
  variant?: "compact" | "detailed";
}) {
  const t = useTranslations("common");
  const cost = formatCost(costUsd);
  const text =
    variant === "detailed" && tokens != null
      ? `${t("cost.tokens", { count: formatTokenCount(tokens) })} · ${cost}`
      : cost;
  return (
    <span className="mono" style={style}>
      {text}
    </span>
  );
}
