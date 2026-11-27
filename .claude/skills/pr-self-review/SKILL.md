---
name: pr-self-review
description: "Pre-PR self-review of ALL local changes (branch vs main + staged, unstaged and untracked files). Routes every changed file to the repo's own skills (UI skills on client files, onion/fastify/drizzle on server files, security on both), runs arch:check/lint/typecheck/check-shared for touched packages, and produces a PASS/BLOCK verdict. Any verified critical finding blocks: a gate stops `gh pr create` and `git push` until the verdict is PASS for exactly the pushed content. Use it before opening a pull request, before pushing a branch, when the gate blocks a push/PR, when the user says 'self-review', 'review my changes', 'ready for PR?', 'check before PR', or when /pr-self-review is invoked."
argument-hint: "[--quick] [--no-cache]"
# Manual only (M2): never auto-invoked by the model — run it as /pr-self-review.
# The push/PR gate hook still requires a PASS verdict.
disable-model-invocation: true
metadata:
  version: "1.0.0"
  updated: "2026-11-27"
  tags: review, pull-request, gate, skills-routing
---

# PR Self Review

Reviews the changes this branch will put in a PR, using the repo's own skills as reviewers, and records a
verdict that a gate enforces. **The skill only reports. It never fixes code.**

Engine: `node .claude/skills/pr-self-review/scripts/prsr.mjs <cmd>` (below written as `prsr`). State lives in
`.devdigest/pr-self-review/` (gitignored): `run.json`, `checks.json`, `verdict.json`, `report.md`,
`pr-body.md`, `cache/`.

Arguments: `--quick` limits the review to the 4 skills that can produce a critical. `--no-cache`
re-reviews every file. Default is a full review with the cache on.

## Steps

### 1. Collect
```bash
node .claude/skills/pr-self-review/scripts/prsr.mjs collect [--quick] [--no-cache]
```
This snapshots the working tree (tracked + untracked, without touching the index) as a tree SHA, diffs
it against `merge-base(origin/main, HEAD)`, and routes each file to skills (`routing.json`, explained in
[references/skill-routing.md](references/skill-routing.md)). It also resolves the per-(skill, file-blob)
cache and lists the deterministic checks. Read `.devdigest/pr-self-review/run.json`: `skills.<name>.toReview`
are the files that still need a subagent, `cached` already has findings.

- Empty diff → tell the user there is nothing to review and stop.
- Pass the warnings on to the user (large diff → suggest splitting, unmapped skills).
- **Don't edit files from here until `finalize`.** `finalize` refuses if the tree changed.

### 2. Deterministic checks (start in parallel with step 3)
```bash
node .claude/skills/pr-self-review/scripts/prsr.mjs checks
```
Run it in the background. It can take minutes. Each failure becomes an unsuppressible critical.

### 3. One subagent per skill with `toReview` files
Launch them in parallel (at most ~5 at a time, the rest in the next wave) with the Agent tool,
`subagent_type: general-purpose`. Skip skills whose `toReview` is empty. Prompt template, filled
from run.json:

```
You are reviewing a diff strictly through the lens of ONE skill: <skill>.
1. Read <skills.<skill>.skillMd> and only the references it points to that are relevant to these files.
2. Read .claude/skills/pr-self-review/references/severity-rubric.md and finding-schema.md.
3. Get the changes: git diff <base> <tree_sha> -- <toReview files…>
   (base and tree_sha are commit/tree SHAs; the tree includes uncommitted and untracked work).
   Full new file content: git show <tree_sha>:<path>
4. Review ONLY added/changed lines of these files: <toReview files…>
   Report only concrete violations of <skill>'s rules. Apply the rubric's critical bar strictly. When in doubt, major.
   Line numbers refer to the new file version.
5. Your final message is ONLY the JSON object from finding-schema.md, with "skill": "<skill>".
Do not modify any files.
```

### 4. Verify criticals, then assemble results
- Parse every subagent's JSON. If one is not valid JSON, re-ask that subagent once, then record
  `{"skill": …, "status": "error", "error": "invalid output", "findings": []}`.
- **For each critical:** read the code at `file:line` in the snapshot (`git show <tree_sha>:<file>`) and
  check it against the rubric row. If it is real, set `"verified": true`. If it is wrong, drop it or
  downgrade it to major/minor. Never mark a critical verified without reading the code.
- Write `{"results": [...]}` to `.devdigest/pr-self-review/results.json`.

### 5. Finalize
Wait for step 2 to finish, then:
```bash
node .claude/skills/pr-self-review/scripts/prsr.mjs finalize .devdigest/pr-self-review/results.json
```
This merges cached and fresh findings plus check failures, applies suppressions, dedupes by `file:line`,
and writes the cache, `verdict.json`, `report.md`, and on PASS `pr-body.md`. Exit code 0 means PASS,
3 means BLOCK.

### 6. Report to the user
- **BLOCK:** say clearly that the PR must not be opened or merged yet. List every critical as
  `file:line`, skill, rule and the fix. Point to `report.md`. Offer to fix. Don't fix unasked.
- **PASS:** give the counts, the majors worth a look, and the report path. When opening the PR use
  `gh pr create --body-file .devdigest/pr-self-review/pr-body.md`, after filling in its Summary section.
- Remind the user that the verdict covers exactly this content. Commit precisely what was reviewed.
  Any later change to a reviewable file makes the verdict stale, and re-running is cheap thanks to the
  cache.

## Gate

`prsr gate` blocks when there is no verdict, when the verdict is BLOCK, or when any reviewable file in the
commit being pushed differs from the reviewed snapshot. It is wired twice:
- Claude Code: `.claude/hooks/pr-gate.sh` (PreToolUse on Bash) blocks `gh pr create` and `git push`
  with exit 2.
- Terminal: `.githooks/pre-push` (enabled by `scripts/dev.sh` via `git config core.hooksPath .githooks`).

Pushes to `main`/`master`, branch deletions, and branches whose diff vs main touches only excluded files
pass. **Bypass** (only when the user explicitly asks): `PR_SELF_REVIEW_SKIP=1 <cmd>` or
`git push --no-verify`. Never bypass on your own to get past a BLOCK.
`prsr status` shows the current verdict and whether the gate is open for HEAD.

## Suppressing a false positive

Suppressions apply only to skill findings. Check failures and incomplete reviews can never be suppressed.
A reason is mandatory. An entry without one is ignored and becomes a major itself. Every suppression is
listed in the report and in the PR body.
- Inline, on the flagged line or the line above:
  `// pr-self-review-ignore <skill>/<rule>: <reason>` (`<rule>` may be `*`)
- Repo-wide, in `.pr-self-review-ignore.json` (committed, so it gets reviewed):
  `[{"skill": "security", "rule": "hardcoded-secret", "path": "server/test/**", "reason": "fake fixture keys"}]`

Add a suppression only when the user agrees the finding is wrong. Don't add one to turn BLOCK into PASS.

## Cache

`cache/<skill>/<skillHash>-<rubricHash>/<blob>.json` stores the findings for one file content per skill.
Changing a skill's files, the rubric or the schema invalidates it automatically. The deterministic checks
always run again. Use `--no-cache` when the user doubts a cached result.
