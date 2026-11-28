import type { ConventionCandidate } from "@devdigest/shared";
import { SKILL_BODY_MAX } from "@/components/skills";
import { CONFIDENCE_HIGH, CONFIDENCE_MID, FENCE_LANG, RULE_SLUG_MAX } from "./constants";

/** Lowercase kebab slug of `text`, cut on a word boundary at `max` chars. */
export function slugify(text: string, max: number): string {
  const full = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (full.length <= max) return full;
  const cut = full.slice(0, max);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/** `path:23-31` (or `path:7`, or just `path` when the range is unknown). */
export function evidenceRef(c: Pick<ConventionCandidate, "evidence_path" | "evidence_lines">): string {
  const l = c.evidence_lines;
  if (!l) return c.evidence_path;
  return l.start === l.end ? `${c.evidence_path}:${l.start}` : `${c.evidence_path}:${l.start}-${l.end}`;
}

export function confidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_HIGH) return "var(--ok)";
  if (confidence >= CONFIDENCE_MID) return "var(--warn)";
  return "var(--text-muted)";
}

/** Short repo name ("acme/payments-api" → "payments-api"). */
export function repoShortName(fullName: string): string {
  return fullName.split("/").pop() || fullName;
}

/** Default skill name for a repo: `<repo>-conventions`, a valid SkillName (≤ 64). */
export function defaultSkillName(fullName: string): string {
  const base = slugify(repoShortName(fullName), 64 - "-conventions".length) || "repo";
  return `${base}-conventions`;
}

function fenceLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return FENCE_LANG[ext] ?? "";
}

/** A fence longer than any backtick run inside the snippet. */
function fenceFor(snippet: string): string {
  const longest = Math.max(0, ...(snippet.match(/`+/g) ?? []).map((m) => m.length));
  return "`".repeat(Math.max(3, longest + 1));
}

export interface DraftTexts {
  intro: string;
  detected: string;
  description: string;
}

export interface SkillDraft {
  name: string;
  description: string;
  body: string;
}

/**
 * Draft the skill from the accepted candidates: one `## <slug>` section per rule
 * with its evidence. Sections that would overflow SKILL_BODY_MAX are left out
 * (the user edits the draft before saving anyway).
 */
export function buildSkillDraft(
  name: string,
  accepted: ConventionCandidate[],
  texts: DraftTexts,
): SkillDraft {
  const head = `# ${name}\n\n${texts.intro}\n`;
  const used = new Set<string>();
  let body = head;
  for (const c of accepted) {
    let slug = slugify(c.rule, RULE_SLUG_MAX) || "convention";
    for (let i = 2; used.has(slug); i++) slug = `${slugify(c.rule, RULE_SLUG_MAX)}-${i}`;
    used.add(slug);
    const fence = fenceFor(c.evidence_snippet);
    const section =
      `\n## ${slug}\n${c.rule}\n` +
      (c.evidence_path
        ? `\n${texts.detected} \`${evidenceRef(c)}\`:\n${fence}${fenceLang(c.evidence_path)}\n${c.evidence_snippet}\n${fence}\n`
        : "");
    if (body.length + section.length > SKILL_BODY_MAX) break;
    body += section;
  }
  return { name, description: texts.description, body };
}
