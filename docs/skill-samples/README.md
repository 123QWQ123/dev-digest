# Skill samples

Files for trying the skill **import** flow (Skills → Add Skill → Import from file).

`flaky-test-patterns/` is the fourth Test Quality Reviewer skill. It is not
seeded, so you can import it end to end:

```sh
cd docs/skill-samples && zip -r flaky-test-patterns.zip flaky-test-patterns
```

Upload `flaky-test-patterns.zip`, or just `flaky-test-patterns/SKILL.md`.

- The preview reads only `SKILL.md`.
- `scripts/check.sh` appears under **Ignored files** with a warning. It is never written to
  disk or executed.
- Nothing is saved until you press **Save skill**.
- After saving, link it in Agents → Test Quality Reviewer → Skills.

**Trust:** an imported skill puts someone else's instructions into your agents'
prompt. Read the body in the preview before saving. Imported skills show an
"untrusted" badge.
