import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { SKILL_BODY_MAX, SKILL_NAME_RE } from "@/components/skills";
import { bodyStatus, buildSkillDraft, defaultSkillName, evidenceRef, slugify, confidenceColor } from "./helpers";

const c = (over: Partial<ConventionCandidate> = {}): ConventionCandidate => ({
  id: "c1",
  rule: "Always use async/await instead of .then() chains",
  evidence_path: "src/api/users.ts",
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  accepted: true,
  evidence_lines: { start: 23, end: 31 },
  ...over,
});
const TEXTS = { intro: "House conventions for `payments-api`.", detected: "Detected in", description: "2 house conventions" };

describe("slugify", () => {
  it("kebab-cases and cuts on a word boundary", () => {
    expect(slugify("Always use async/await instead of .then() chains", 40)).toBe("always-use-async-await-instead-of-then");
    expect(slugify("  Hello, World!  ", 40)).toBe("hello-world");
  });
});

describe("evidenceRef", () => {
  it("renders a line range, a single line, or the bare path", () => {
    expect(evidenceRef(c())).toBe("src/api/users.ts:23-31");
    expect(evidenceRef(c({ evidence_lines: { start: 7, end: 7 } }))).toBe("src/api/users.ts:7");
    expect(evidenceRef(c({ evidence_lines: null }))).toBe("src/api/users.ts");
  });
});

describe("defaultSkillName", () => {
  it("is <repo>-conventions and a valid skill name", () => {
    expect(defaultSkillName("acme/payments-api")).toBe("payments-api-conventions");
    const long = defaultSkillName(`acme/${"Very_Long Repo ".repeat(10)}`);
    expect(long.endsWith("-conventions")).toBe(true);
    expect(SKILL_NAME_RE.test(long)).toBe(true);
  });
});

describe("confidenceColor", () => {
  it("uses the ConfidenceNum cut-offs", () => {
    expect(confidenceColor(0.91)).toBe("var(--ok)");
    expect(confidenceColor(0.78)).toBe("var(--warn)");
    expect(confidenceColor(0.4)).toBe("var(--text-muted)");
  });
});

describe("buildSkillDraft", () => {
  it("drafts one section per accepted rule with its evidence", () => {
    const d = buildSkillDraft("payments-api-conventions", [c(), c({ id: "c2", rule: "Redis access goes through the singleton", evidence_path: "src/lib/redis.py", evidence_lines: null })], TEXTS);
    expect(d.name).toBe("payments-api-conventions");
    expect(d.description).toBe("2 house conventions");
    expect(d.body).toContain("# payments-api-conventions\n\nHouse conventions for `payments-api`.");
    expect(d.body).toContain("## always-use-async-await-instead-of-then\nAlways use async/await instead of .then() chains");
    expect(d.body).toContain("Detected in `src/api/users.ts:23-31`:\n```ts\nconst user = await db.users.find(id);\n```");
    expect(d.body).toContain("Detected in `src/lib/redis.py`:\n```python\n");
  });

  it("dedupes section slugs and lengthens the fence around backticks", () => {
    const d = buildSkillDraft("x", [c(), c({ id: "c2", evidence_snippet: "const s = ```hi```;" })], TEXTS);
    expect(d.body).toContain("## always-use-async-await-instead-of-then-2");
    expect(d.body).toContain("````ts\nconst s = ```hi```;\n````");
  });

  it("never exceeds the skill body limit", () => {
    const big = Array.from({ length: 30 }, (_, i) => c({ id: `c${i}`, rule: `Rule ${i}`, evidence_snippet: "x".repeat(1500) }));
    expect(buildSkillDraft("x", big, TEXTS).body.length).toBeLessThanOrEqual(SKILL_BODY_MAX);
  });
});

describe("bodyStatus", () => {
  it("loading wins over error; otherwise ready", () => {
    expect(bodyStatus(true, true)).toBe("loading");
    expect(bodyStatus(false, true)).toBe("error");
    expect(bodyStatus(false, false)).toBe("ready");
  });
});
