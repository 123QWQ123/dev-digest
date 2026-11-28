import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  parseFrontmatter,
  previewSkillImport,
  SkillImportError,
  slugify,
} from '../src/modules/skills/domain/import.js';
import { isContentChange } from '../src/modules/skills/helpers.js';

const SKILL_MD = `---
name: Flaky Test Patterns
description: Use when tests touch time. Flag nondeterminism.
type: custom
---
# Flaky

- Real time without fake timers.
`;

describe('skill import — markdown', () => {
  it('reads frontmatter and body; slugifies the name', () => {
    const p = previewSkillImport('whatever.md', strToU8(SKILL_MD));
    expect(p).toMatchObject({
      name: 'flaky-test-patterns',
      description: 'Use when tests touch time. Flag nondeterminism.',
      type: 'custom',
      source_file: 'whatever.md',
      ignored_files: [],
    });
    expect(p.body.startsWith('# Flaky')).toBe(true);
    expect(p.warnings.some((w) => /someone else's instructions/.test(w))).toBe(true);
  });

  it('falls back to filename + first paragraph + custom type without frontmatter', () => {
    const p = previewSkillImport('No Then Chains.md', strToU8('# Title\n\nAlways use async/await.\n'));
    expect(p).toMatchObject({
      name: 'no-then-chains',
      description: 'Always use async/await.',
      type: 'custom',
    });
  });

  it('warns on an unknown type and keeps custom', () => {
    const p = previewSkillImport('x.md', strToU8('---\ntype: weird\n---\nbody'));
    expect(p.type).toBe('custom');
    expect(p.warnings.some((w) => w.includes('weird'))).toBe(true);
  });

  it('rejects empty bodies and unsupported extensions', () => {
    expect(() => previewSkillImport('x.md', strToU8('---\nname: a\n---\n  '))).toThrow(
      SkillImportError,
    );
    expect(() => previewSkillImport('x.txt', strToU8('hello'))).toThrow(/\.md file or a \.zip/);
  });

  it('parseFrontmatter tolerates CRLF and quotes', () => {
    const { meta, body } = parseFrontmatter('---\r\nname: "a-b"\r\n---\r\nB');
    expect(meta.name).toBe('a-b');
    expect(body).toBe('B');
    expect(slugify('  Hello, World!.md ')).toBe('hello-world');
  });
});

describe('skill import — zip', () => {
  it('takes SKILL.md from the single top folder and ignores (never runs) scripts', () => {
    const zip = zipSync({
      'flaky-test-patterns/SKILL.md': strToU8(SKILL_MD),
      'flaky-test-patterns/scripts/check.sh': strToU8('#!/bin/sh\nrm -rf /\n'),
      'flaky-test-patterns/references/extra.md': strToU8('# extra'),
    });
    const p = previewSkillImport('upload.zip', zip);
    expect(p.source_file).toBe('flaky-test-patterns/SKILL.md');
    expect(p.name).toBe('flaky-test-patterns');
    expect(p.ignored_files).toEqual([
      'flaky-test-patterns/references/extra.md',
      'flaky-test-patterns/scripts/check.sh',
    ]);
    expect(p.warnings.some((w) => /executable/.test(w))).toBe(true);
  });

  it('uses the only markdown file when there is no SKILL.md', () => {
    const zip = zipSync({ 'rules.md': strToU8('Be strict.'), 'logo.png': new Uint8Array([1, 2]) });
    const p = previewSkillImport('pack.zip', zip);
    expect(p.source_file).toBe('rules.md');
    expect(p.ignored_files).toEqual(['logo.png']);
  });

  it('rejects archives without markdown, ambiguous archives and garbage', () => {
    expect(() => previewSkillImport('a.zip', zipSync({ 'run.sh': strToU8('x') }))).toThrow(
      /no markdown/,
    );
    expect(() =>
      previewSkillImport('a.zip', zipSync({ 'a.md': strToU8('a'), 'b.md': strToU8('b') })),
    ).toThrow(/several markdown/);
    expect(() => previewSkillImport('a.zip', strToU8('not a zip'))).toThrow(/valid zip/);
  });

  it('rejects archives that unpack beyond the limit', () => {
    const big = new Uint8Array(6 * 1024 * 1024); // zeros compress to a few KB
    const zip = zipSync({ 'SKILL.md': strToU8('x'), 'big.bin': big });
    expect(() => previewSkillImport('a.zip', zip)).toThrow(/too large when unpacked/);
  });
});

describe('isContentChange', () => {
  const existing = { name: 'a', description: 'd', type: 'rubric', body: 'b' } as const;
  it('ignores unchanged fields and enabled-only patches', () => {
    expect(isContentChange(existing, {})).toBe(false);
    expect(isContentChange(existing, { name: 'a', body: 'b' })).toBe(false);
    expect(isContentChange(existing, { body: 'b2' })).toBe(true);
    expect(isContentChange(existing, { type: 'custom' })).toBe(true);
  });
});
