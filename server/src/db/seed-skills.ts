/**
 * Built-in skills seeded for the Test Quality Reviewer (M2). Each is TEXT ONLY:
 * rendered as `### <name>` + body into the `## Skills / rules` prompt block.
 * The fourth skill of the set, `flaky-test-patterns`, is deliberately NOT seeded:
 * it lives in docs/skill-samples/ and is brought in through the import preview.
 *
 * Descriptions are the skill's interface: directive, "Use when … / Flag …".
 */

export interface SeedSkill {
  name: string;
  description: string;
  type: 'rubric' | 'convention' | 'security' | 'custom';
  body: string;
}

export const TEST_QUALITY_SKILLS: SeedSkill[] = [
  {
    name: 'branch-coverage-gate',
    description:
      'Use on every PR that changes production logic. Flag each new or changed branch that no test in the diff reaches.',
    type: 'rubric',
    body: `# Branch coverage gate

For EVERY function the diff adds or changes:

1. Enumerate its branches from the diff: each \`if\`/\`else\`, \`switch\` case, early
   \`return\`/\`throw\`, \`??\`/\`||\` fallback, \`catch\` block and optional-chaining
   short-circuit.
2. For each branch, find a test in the diff whose input reaches it.
3. A branch with no reaching test is a finding. Cite the production line of the
   branch, name the input that would reach it, and name the test file that
   should cover it.

Severity:
- Uncovered error/guard branch (\`throw\`, validation failure, 4xx/5xx path,
  permission check) → WARNING; CRITICAL when it guards data loss, money or auth.
- Uncovered happy-path variant → WARNING.

A test file that only exercises the happy path of a function with guard
branches is NOT adequate coverage, even if every line of the happy path runs.`,
  },
  {
    name: 'corner-case-checklist',
    description:
      'Use when a changed function takes collections, numbers, strings, dates or optional values. Flag boundary inputs the tests never try.',
    type: 'rubric',
    body: `# Corner-case checklist

For each changed function, check the tests try the boundaries its inputs allow.
Flag a missing case only when the changed code visibly depends on it.

- **Collections**: empty, exactly one element, duplicates, very large.
- **Numbers**: 0, negative, the exact limit/threshold (off-by-one at \`<\` vs
  \`<=\`), NaN, non-integer where an integer is assumed.
- **Strings**: empty, whitespace-only, unicode/emoji, max length.
- **Optional values**: \`null\`, \`undefined\`, missing key vs. explicit null.
- **Dates/time**: timezone boundary, DST, end of month, \`Date.now()\` at the limit.
- **Concurrency/async**: the same call twice in parallel, a rejection mid-way.

Report as WARNING: "<function> handles <boundary> at <file:line> but no test
passes <concrete input>". Do not list boundaries the code does not depend on.`,
  },
  {
    name: 'mock-discipline',
    description:
      'Use when tests in the diff use vi.mock, spies or stubs. Flag mocks of the unit under test and assertions that only check a mock.',
    type: 'convention',
    body: `# Mock discipline (house convention)

- Mock only the outside world: network, LLM providers, GitHub, the clock,
  randomness. In this repo use \`src/adapters/mocks.ts\` doubles.
- NEVER mock the module under test or its own helpers. A test that does is a
  CRITICAL finding: it cannot fail when the real code regresses.
- DB-backed behaviour gets a real Postgres integration test (\`*.it.test.ts\`),
  not a mocked repository, when the change is in a query or a transaction.
- An assertion like \`expect(mock).toHaveBeenCalled()\` with no assertion on the
  observable result is a WARNING: it pins implementation, not behaviour.
- \`vi.mock\` paths must match the component's import specifier exactly, or the
  mock silently doesn't apply.`,
  },
];
