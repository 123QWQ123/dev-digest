import { describe, it, expect } from 'vitest';
import {
  clampConfidence,
  locateSnippet,
  normalizeRule,
  verifyCandidates,
} from '../src/modules/conventions/domain/verify.js';

const FILE = [
  "import { z } from 'zod';",
  '',
  'export async function load(id: string) {',
  '    const user = await db.users.find(id);',
  '',
  '    const posts = await db.posts.findMany({ userId: id });',
  '    return { user, posts };',
  '}',
].join('\n');

const files = new Map([['src/api/users.ts', FILE]]);
const cand = (over: Partial<{ rule: string; evidence_path: string; evidence_snippet: string; confidence: number }> = {}) => ({
  rule: 'Use async/await instead of .then() chains',
  evidence_path: 'src/api/users.ts',
  evidence_snippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId: id });',
  confidence: 0.9,
  ...over,
});

describe('locateSnippet', () => {
  it('ignores indentation and blank lines and returns the original line range', () => {
    expect(locateSnippet(FILE, '  const user = await db.users.find(id);\n   const posts = await db.posts.findMany({ userId: id });')).toEqual({ start: 4, end: 6 });
  });
  it('matches a one-line fragment inside a longer line', () => {
    expect(locateSnippet(FILE, 'db.users.find(id)')).toEqual({ start: 4, end: 4 });
  });
  it('allows partial first/last lines of a multi-line snippet', () => {
    expect(locateSnippet(FILE, 'function load(id: string) {\nconst user')).toEqual({ start: 3, end: 4 });
  });
  it('returns null for text that is not in the file', () => {
    expect(locateSnippet(FILE, 'const user = await db.users.get(id);\nreturn user;')).toBeNull();
    expect(locateSnippet(FILE, '   \n  ')).toBeNull();
  });
});

describe('verifyCandidates', () => {
  it('keeps a grounded candidate with its line range', () => {
    const { kept, dropped } = verifyCandidates([cand()], files);
    expect(dropped).toEqual([]);
    expect(kept).toEqual([
      expect.objectContaining({ evidencePath: 'src/api/users.ts', lines: { start: 4, end: 6 }, confidence: 0.9 }),
    ]);
  });

  it('drops files that were not sent, invented snippets, empties and duplicates', () => {
    const { kept, dropped } = verifyCandidates(
      [
        cand({ evidence_path: '../../etc/passwd' }),
        cand({ rule: 'Other', evidence_snippet: 'await fetch(url)' }),
        cand({ rule: '  ', evidence_snippet: 'x' }),
        cand(),
        cand({ rule: 'use async/await instead of .then() chains.' }),
      ],
      files,
    );
    expect(kept).toHaveLength(1);
    expect(dropped.map((d) => d.reason)).toEqual(['unknown_file', 'snippet_not_found', 'empty', 'duplicate']);
  });

  it('skips rules that are already accepted', () => {
    const { kept, dropped } = verifyCandidates([cand()], files, new Set([normalizeRule(cand().rule)]));
    expect(kept).toEqual([]);
    expect(dropped[0]!.reason).toBe('duplicate');
  });

  it('accepts a leading ./ on the path', () => {
    expect(verifyCandidates([cand({ evidence_path: './src/api/users.ts' })], files).kept).toHaveLength(1);
  });
});

describe('clampConfidence', () => {
  it('clamps to 0..1 and rescales percentages', () => {
    expect(clampConfidence(0.4)).toBe(0.4);
    expect(clampConfidence(85)).toBe(0.85);
    expect(clampConfidence(-1)).toBe(0);
    expect(clampConfidence(500)).toBe(1);
    expect(clampConfidence(Number.NaN)).toBe(0);
  });
});
