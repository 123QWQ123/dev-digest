import type { ConventionCandidate } from '@devdigest/shared';
import type { ConventionRow } from '../../db/rows.js';
import { wrapUntrusted } from '../../platform/prompt.js';

/** DB row → API DTO. Legacy rows without evidence get empty strings (contract requires them). */
export function toConventionDto(row: ConventionRow): ConventionCandidate {
  const hasLines = row.evidenceLineStart != null && row.evidenceLineEnd != null;
  return {
    id: row.id,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    accepted: row.accepted,
    evidence_lines: hasLines ? { start: row.evidenceLineStart!, end: row.evidenceLineEnd! } : null,
    created_at: row.createdAt.toISOString(),
  };
}

/** Newest `created_at` across rows, ISO, or null. */
export function lastScanAt(rows: ConventionRow[]): string | null {
  let max: Date | null = null;
  for (const r of rows) if (!max || r.createdAt > max) max = r.createdAt;
  return max ? max.toISOString() : null;
}

/** Cap a file for the prompt, marking the cut. */
export function capContent(content: string, maxChars: number): string {
  return content.length <= maxChars ? content : `${content.slice(0, maxChars)}\n… [truncated]`;
}

/**
 * The user message: config files first, then ranked samples, each wrapped as
 * untrusted DATA with its repo-relative path as the `source` label.
 */
export function buildUserMessage(
  repoName: string,
  configs: ReadonlyMap<string, string>,
  samples: ReadonlyMap<string, string>,
): string {
  const parts = [`Repository: ${repoName}`];
  if (configs.size > 0) {
    parts.push('## Config files');
    for (const [path, content] of configs) parts.push(wrapUntrusted(path, content));
  }
  parts.push('## Source files (most important first)');
  for (const [path, content] of samples) parts.push(wrapUntrusted(path, content));
  return parts.join('\n\n');
}
