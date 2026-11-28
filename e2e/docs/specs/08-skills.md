# 08 — Skills

## User journey
The user opens Skills Lab → Skills, sees the seeded skills, opens one and sees its
config, then opens the Test Quality Reviewer agent and sees its linked skills on the Skills tab.

## Seed data needed
`server/src/db/seed.ts`: the skills `branch-coverage-gate`, `corner-case-checklist` and
`mock-discipline`, linked in that order to the **Test Quality Reviewer** agent.

## Steps
1. Open `{BASE}/skills` and wait for `branch-coverage-gate`.
2. Click the `branch-coverage-gate` card (`find testid skill-card-branch-coverage-gate` — its name is also an i18n placeholder, so `find text` may hit a hidden RSC script) and wait for its Config form ("Skill body").
3. Click the `Stats` tab and wait for its footnote and the `Test Quality Reviewer` row (tile labels are CSS-uppercased, so `wait --text` cannot match their source text).
4. Open `{BASE}/agents`, wait for `Test Quality Reviewer` and click it.
5. Click the `Skills` tab.

## Assertions
- The skill list shows all three seeded skills.
- The skill Stats tab renders its tiles and the agents panel (numbers depend on runs, so not asserted).
- The agent's Skills tab shows "3 of" in its enabled count, plus `mock-discipline`.
