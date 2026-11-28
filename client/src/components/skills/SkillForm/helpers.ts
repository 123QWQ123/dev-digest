import { SKILL_BODY_MAX, SKILL_NAME_RE } from "../constants";
import type { SkillFormValues } from "./types";

export const EMPTY_SKILL: SkillFormValues = {
  name: "",
  description: "",
  type: "custom",
  body: "",
  enabled: true,
  note: "",
};

/** Client-side mirror of the server's skill rules (the API validates authoritatively). */
export function isValidSkill(v: SkillFormValues): boolean {
  return (
    SKILL_NAME_RE.test(v.name) &&
    v.description.trim().length > 0 &&
    v.body.trim().length > 0 &&
    v.body.length <= SKILL_BODY_MAX
  );
}
