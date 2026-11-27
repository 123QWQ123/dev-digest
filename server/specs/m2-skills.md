# M2 — Skills (server)

## Goal
Reusable, versioned markdown instruction blocks ("skills") that many agents can link to.
Each link has its own order and enabled flag. A skill is **text configuration only**:
name, description, type and markdown body. It has no scripts, tools or executable parts.
The DB is the source of truth. Enabled skills are rendered into the review prompt's
`## Skills / rules` block in link order (see `reviewer-core/specs/m2-skills-prompt.md`).

## Scope / Non-goals
- In: skills CRUD, version history and restore, import preview (`.md` / `.zip`),
  per-agent link/enable/order, passing skills into reviews, per-slot prompt token counts in the trace,
  seeding the Test Quality Reviewer agent and its skills, 30-day usage stats for skills and agents
  (Stats tabs + card lines), a token counter for the editors.
- Out: skill/agent evals and "Run on evals", the agent CI tab — M6 (needs the eval pipeline); import
  from URL or community catalog; extracted conventions (separate M2 feature); multipart upload.

## Data (migration 0011)
- `agent_skills.enabled boolean not null default true`.
- `skills.updated_at timestamptz`, plus a unique index on `(workspace_id, name)`.
- `skill_versions` gains `name`, `description`, `type` and `note`, so each version is a full snapshot.
- `SkillSource` gains `imported`. It is a text enum with no CHECK, so no data change is needed.

## Data (migration 0012)
- `run_skills(run_id → agent_runs, skill_id → skills, skill_version)`, PK `(run_id, skill_id)`, index on
  `skill_id`. Written by the run executor next to `trace.prompt_assembly.skills_used`; it is the
  relational source for skill stats (no jsonb scans over traces).

## API
| Method | Path | Behaviour |
|---|---|---|
| GET | `/skills` | Workspace skills with `agent_count`, sorted by name |
| GET | `/skills/:id` | One skill; 404 if it is in another workspace |
| POST | `/skills` | Create the skill and snapshot v1. Duplicate name → 409 |
| PUT | `/skills/:id` | Any change to name, description, type or body → `version+1` plus a snapshot with an optional `note`. Toggling `enabled` alone creates no version |
| DELETE | `/skills/:id` | Agent links are removed by cascade |
| GET | `/skills/:id/stats` | `SkillStats` over 30 days: `used_by` agents, `pull_rate`, `accept_rate`, `findings`, `findings_by_category` |
| GET | `/agents/:id/stats` | The M7 `AgentStats` contract over 30 days (runs, accept/dismiss, cost, latency, severity split, score trend) |
| POST | `/tokens/count` | `{text}` → `{tokens}` with the trace tokenizer (cl100k); text ≤ 100 000 chars |
| GET | `/skills/:id/versions` | Newest first |
| GET | `/skills/:id/versions/:version` | One snapshot |
| POST | `/skills/:id/versions/:version/restore` | Writes a **new** version with the old content; history is never rewritten |
| POST | `/skills/import/preview` | `{filename, content_base64}` → `SkillImportPreview`. **Persists nothing** |
| GET | `/agents/:id/skills` | `AgentSkill[]`: linked skills in order, with link `enabled` and `skill_enabled` |
| PUT | `/agents/:id/skills` | `{items:[{skill_id, enabled}]}`. Array order becomes the link order. The full set is replaced in one transaction. Any skill outside the workspace → 422 |

`GET /agents` and `GET /agents/:id` return `skill_count`: the number of links that are enabled
and whose skill is enabled. The old `POST /agents/:id/skills` is removed; it had no consumers.

## Import rules (`modules/skills/import/parse.ts`, pure)
- `.md`: optional frontmatter with flat `key: value` pairs for `name`, `description` and `type`.
  Everything after it is the body. With no frontmatter, the name comes from the filename,
  the description is the first paragraph, and the type is `custom`.
- `.zip` (`fflate`): use `SKILL.md` at the root or inside the single top-level folder.
  Otherwise use the only `.md` in the archive. Otherwise → 422.
  Every other entry goes to `ignored_files` and is **never written to disk or executed**.
  Executable-looking entries (`.sh`, `.py`, `.js`, …, `scripts/`) also add a warning.
- Limits: archive ≤ 1 MB, uncompressed ≤ 5 MB, ≤ 200 entries, body ≤ 20 000 chars.
- Every preview warns that an imported skill is someone else's instructions in your agents' prompt.
- The user saves the skill with `POST /skills` and `source: imported`. The client shows the skill as untrusted.

## Review pipeline
- `run-executor` loads the **effective** skills for the run's agent: linked, link enabled and skill enabled,
  in order. It formats each one with `formatSkill(name, body)` from reviewer-core and passes them as `skills`.
- The trace records `prompt_assembly.skills_used` (`{id, name, version}[]`) and
  `prompt_tokens` (tiktoken count per non-empty assembly slot).

## Stats definitions (30-day window, completed runs only)
- **Runs of a skill** = runs whose agent currently links the skill OR that rendered it (`run_skills`).
- **Pull rate** = runs that rendered the skill ÷ runs of the skill. A linked-but-unticked skill shows 0%.
- **Accept rate** = accepted ÷ (accepted + dismissed) over findings of runs that rendered the skill;
  null when nothing is triaged. Findings are attributed by co-occurrence — the model does not tag
  findings per skill, so a finding counts for every skill in its run's prompt.
- `GET /skills` and `GET /agents` carry a card-sized `stats` summary (pull/accept, runs/accept/avg cost).

## Acceptance criteria
- CRUD, version bump/no-bump, restore and 404/409/422 paths are covered by `test/skills.it.test.ts`.
- A disabled skill, or a disabled link, never reaches the prompt or `skills_used`.
- A zip containing `scripts/*.sh` previews its `SKILL.md` and lists the script in `ignored_files`.
- Stats: a run with skills writes `run_skills`; skill and agent stats (incl. list `stats`) match triaged
  findings; a linked-but-disabled skill has pull rate 0 (`test/skills.it.test.ts`).
- The seed is idempotent: Test Quality Reviewer is linked to 3 skills; `flaky-test-patterns` is imported by hand.

## Open questions
- Should a run pin skill versions, or always use the latest? Today it uses the latest and the trace records which version ran.
