/**
 * assemblePrompt — the `## Skills / rules` slot (M2). Skills are formatted by
 * `formatSkill`, rendered in the user message in link order, never in the
 * system message, and an absent/empty slot leaves the prompt unchanged.
 */
import { describe, it, expect } from 'vitest';
import { assemblePrompt, formatSkill } from '../src/prompt.js';

describe('formatSkill', () => {
  it('renders a named markdown block with trimmed body', () => {
    expect(formatSkill(' branch-gate ', '\n- Flag X\n')).toBe('### branch-gate\n\n- Flag X');
  });
});

describe('assemblePrompt — ## Skills / rules', () => {
  const base = { system: 'sys', diff: 'DIFF', prDescription: 'desc' };

  it('renders skills in the given order in the user message only', () => {
    const { messages, assembly } = assemblePrompt({
      ...base,
      skills: [formatSkill('first', 'A-RULE'), formatSkill('second', 'B-RULE')],
    });
    const [system, user] = [messages[0]!.content, messages[1]!.content];
    expect(system).not.toContain('A-RULE');
    expect(user).toContain('## Skills / rules\n### first\n\nA-RULE\n\n### second\n\nB-RULE');
    expect(user.indexOf('A-RULE')).toBeLessThan(user.indexOf('B-RULE'));
    expect(user.indexOf('## PR description')).toBeLessThan(user.indexOf('## Skills / rules'));
    expect(user.indexOf('## Skills / rules')).toBeLessThan(user.indexOf('## Diff to review'));
    expect(assembly.skills).toBe('### first\n\nA-RULE\n\n### second\n\nB-RULE');
  });

  it('leaves the prompt identical when skills are absent or empty', () => {
    const without = assemblePrompt(base);
    const empty = assemblePrompt({ ...base, skills: [] });
    expect(empty.messages).toEqual(without.messages);
    expect(empty.assembly.skills).toBeNull();
    expect(without.messages[1]!.content).not.toContain('## Skills / rules');
  });
});
