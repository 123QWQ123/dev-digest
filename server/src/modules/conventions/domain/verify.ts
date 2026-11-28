import {
  CONVENTION_RULE_MAX,
  CONVENTION_SNIPPET_MAX,
  type ConventionExtraction,
  type EvidenceLines,
} from '@devdigest/shared';

/** A candidate whose evidence was proven against a file we actually sent. */
export interface VerifiedCandidate {
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
  lines: EvidenceLines;
}

export type DropReason = 'unknown_file' | 'empty' | 'too_long' | 'snippet_not_found' | 'duplicate';

export interface VerifyResult {
  kept: VerifiedCandidate[];
  dropped: { rule: string; reason: DropReason }[];
}

/** Whitespace-insensitive form of one line: trimmed, inner runs collapsed. */
function normLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/** Normalized rule text, used to dedupe candidates. */
export function normalizeRule(rule: string): string {
  return rule.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
}

/**
 * Find `snippet` in `content`, ignoring indentation, inner whitespace runs and
 * blank lines. Returns the 1-based inclusive line range in `content`, or null.
 */
export function locateSnippet(content: string, snippet: string): EvidenceLines | null {
  const needle = snippet.split(/\r?\n/).map(normLine).filter((l) => l.length > 0);
  if (needle.length === 0) return null;
  // Non-blank file lines with their original 1-based numbers.
  const hay: { text: string; no: number }[] = [];
  content.split(/\r?\n/).forEach((l, i) => {
    const text = normLine(l);
    if (text.length > 0) hay.push({ text, no: i + 1 });
  });

  if (needle.length === 1) {
    // A one-line snippet may be a fragment of a longer line.
    const hit = hay.find((h) => h.text.includes(needle[0]!));
    return hit ? { start: hit.no, end: hit.no } : null;
  }
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      const h = hay[i + j]!.text;
      const n = needle[j]!;
      // First/last snippet lines may be partial (the model trims around them).
      const ok =
        j === 0 ? h.endsWith(n) : j === needle.length - 1 ? h.startsWith(n) : h === n;
      if (!ok) continue outer;
    }
    return { start: hay[i]!.no, end: hay[i + needle.length - 1]!.no };
  }
  return null;
}

/**
 * Ground every model candidate in code. A candidate survives only if its
 * `evidence_path` is one of the files we sent (so the model can't cite or
 * traverse arbitrary paths) and its snippet really occurs in that file.
 * Rules already in `existingRules` (normalized) and in-batch repeats are dropped.
 */
export function verifyCandidates(
  candidates: ConventionExtraction['conventions'],
  files: ReadonlyMap<string, string>,
  existingRules: ReadonlySet<string> = new Set(),
): VerifyResult {
  const kept: VerifiedCandidate[] = [];
  const dropped: VerifyResult['dropped'] = [];
  const seen = new Set(existingRules);

  for (const c of candidates) {
    const rule = c.rule.trim();
    const path = c.evidence_path.trim().replace(/^\.\//, '');
    const snippet = c.evidence_snippet.replace(/^\n+|\s+$/g, '');
    const drop = (reason: DropReason) => dropped.push({ rule, reason });

    if (!rule || !snippet.trim()) { drop('empty'); continue; }
    if (rule.length > CONVENTION_RULE_MAX || snippet.length > CONVENTION_SNIPPET_MAX) {
      drop('too_long');
      continue;
    }
    const content = files.get(path);
    if (content === undefined) { drop('unknown_file'); continue; }
    const lines = locateSnippet(content, snippet);
    if (!lines) { drop('snippet_not_found'); continue; }
    const key = normalizeRule(rule);
    if (seen.has(key)) { drop('duplicate'); continue; }
    seen.add(key);

    kept.push({ rule, evidencePath: path, evidenceSnippet: snippet, confidence: clampConfidence(c.confidence), lines });
  }
  return { kept, dropped };
}

/** 0..1; a model answering in percent (e.g. 85) is rescaled. */
export function clampConfidence(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const v = raw > 1 && raw <= 100 ? raw / 100 : raw;
  return Math.min(1, Math.max(0, v));
}
