/* CategoryDonut — findings-by-category ring with integer counts in the legend. */
import React from "react";
import { Donut } from "@devdigest/ui";
import type { CategoryCount } from "@devdigest/shared";
import { categoryColor } from "./helpers";

export function CategoryDonut({ data, empty }: { data: CategoryCount[]; empty: string }) {
  if (data.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "24px 0" }}>{empty}</div>;
  }
  return (
    <Donut
      segments={data.map((d) => ({ label: d.category, value: d.count, color: categoryColor(d.category) }))}
      formatValue={(v) => String(v)}
    />
  );
}
