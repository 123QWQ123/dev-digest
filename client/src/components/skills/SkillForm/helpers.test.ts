import { describe, it, expect } from "vitest";
import { SKILL_BODY_MAX } from "../constants";
import { EMPTY_SKILL, isValidSkill } from "./helpers";

const valid = { ...EMPTY_SKILL, name: "repo-conventions", description: "Use when…", body: "# rules" };

describe("isValidSkill", () => {
  it("accepts a complete skill", () => {
    expect(isValidSkill(valid)).toBe(true);
  });

  it("rejects a name that is not a kebab-case slug", () => {
    expect(isValidSkill({ ...valid, name: "" })).toBe(false);
    expect(isValidSkill({ ...valid, name: "Repo Conventions" })).toBe(false);
    expect(isValidSkill({ ...valid, name: "-leading-dash" })).toBe(false);
    expect(isValidSkill({ ...valid, name: "a".repeat(65) })).toBe(false);
  });

  it("rejects a blank description or body", () => {
    expect(isValidSkill({ ...valid, description: "   " })).toBe(false);
    expect(isValidSkill({ ...valid, body: "\n\n" })).toBe(false);
  });

  it("rejects a body over the limit", () => {
    expect(isValidSkill({ ...valid, body: "x".repeat(SKILL_BODY_MAX) })).toBe(true);
    expect(isValidSkill({ ...valid, body: "x".repeat(SKILL_BODY_MAX + 1) })).toBe(false);
  });
});
