# Skills — control experiment (M2)

Goal: show that skills change what an agent finds. We run the same agent on the same PR twice:
once **without** skills and once **with** them. Then we check the prompt assembly in the run trace.

Agent: **Test Quality Reviewer** (seeded). Its skills are `branch-coverage-gate`,
`corner-case-checklist`, `mock-discipline` (seeded) and `flaky-test-patterns` (added via import,
see `docs/skill-samples/README.md`).

## 1. The PR: a test that covers only the happy path

In any sandbox GitHub repo you can add to DevDigest, open a PR with these two files:

`src/discount.ts`
```ts
export function applyDiscount(total: number, code: string | undefined): number {
  if (total <= 0) throw new Error('total must be positive');
  if (!code) return total;
  if (code === 'VIP') return Math.round(total * 0.8 * 100) / 100;
  if (code.startsWith('PROMO-')) {
    const pct = Number(code.slice(6));
    if (!Number.isInteger(pct) || pct < 1 || pct > 50) return total;
    return Math.round(total * (1 - pct / 100) * 100) / 100;
  }
  return total;
}
```

`src/discount.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { applyDiscount } from './discount';

describe('applyDiscount', () => {
  it('applies the VIP discount', () => {
    expect(applyDiscount(100, 'VIP')).toBe(80);
  });
});
```

What the test misses:
- **Uncovered branches:** `total <= 0` throws; there is no code; there is a `PROMO-` code; there is an unknown code.
- **Edge cases:** `PROMO-0`, `PROMO-50` vs `PROMO-51` (off-by-one at the limit), `PROMO-abc`, `total = 0`.

## 2. Run without skills (baseline)

1. Go to **Agents → Test Quality Reviewer → Skills** and untick every skill.
   The header shows `0 of N enabled`.
2. Import the PR, open it and run **Test Quality Reviewer** only.
3. Expected: generic findings at best ("add more tests"). The specific uncovered branches and
   the `PROMO-50/51` boundary are usually **missed**.

## 3. Run with skills

1. Tick the skills again. Order: `branch-coverage-gate`, `corner-case-checklist`, `mock-discipline`,
   then `flaky-test-patterns`.
2. Re-run the agent on the same PR.
3. Expected:
   - WARNING findings that name the **uncovered branches**: the `total <= 0` throw, the no-code path,
     and the `PROMO-` path.
   - A **boundary** finding (`PROMO-50` / `PROMO-51` / non-integer percent), each citing `src/discount.ts`.

## 4. Check the trace

Open the run → **Trace → Prompt assembly**:
- **Skills / rules (dynamic)** is a separate block. It shows `### <skill-name>` sections in link order,
  the line `Skills: branch-coverage-gate v1, …` and its token count (`N tok`).
- The baseline run has **no** Skills block. Its `User / diff` token count is smaller by about the size
  of the Skills block.
- Untick one skill and re-run: that skill is gone from both the block and the `Skills:` line.

The same rule is covered by the automated test `server/test/skills.it.test.ts`
("a review renders only effective skills…"), which uses a stubbed LLM.
