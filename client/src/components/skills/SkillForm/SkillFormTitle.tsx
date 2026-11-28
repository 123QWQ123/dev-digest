"use client";

import React from "react";
import { Badge } from "@devdigest/ui";
import { s } from "./styles";

/** Heading for `SkillForm`'s `header` slot: a title plus an optional version badge. */
export function SkillFormTitle({ title, version }: { title: React.ReactNode; version?: number }) {
  return (
    <div style={s.titleGroup}>
      <h2 style={s.h2}>{title}</h2>
      {version != null && (
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          v{version}
        </Badge>
      )}
    </div>
  );
}
