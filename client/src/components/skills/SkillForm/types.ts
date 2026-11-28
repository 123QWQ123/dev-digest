import type { ReactNode } from "react";
import type { SkillType } from "@devdigest/shared";

export interface SkillFormValues {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  note: string;
}

/** The submit area: pending state, label, an extra gate and content above the buttons. */
export interface SkillFormSubmit {
  pending?: boolean;
  label?: string;
  /** Extra gate besides validity (e.g. "I trust this skill"). */
  blocked?: boolean;
  /** Rendered above the buttons (e.g. the import trust confirmation). */
  extra?: ReactNode;
}
