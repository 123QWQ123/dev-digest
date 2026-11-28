# M2 — Conventions Extractor (server)

## Goal
Find a repo's unwritten house rules in its code, show each one with evidence from a real file, and let
the user turn the accepted ones into one `convention` skill. Many weak candidates are fine — the user
filters them; candidates without real evidence never reach the DB.

## Scope / Non-goals
- In: sampling by code, one structured LLM call (`conventions` feature model), evidence verification,
  candidate list/edit/accept/reject, re-scan, saving accepted candidates as a skill.
- Out: background job / progress stream (extraction is synchronous), per-candidate skills, auto-linking
  the skill to an agent (the user does it in the agent's Skills tab), extraction history.

## Data (migration 0014)
- `conventions` gains `evidence_line_start`, `evidence_line_end` (1-based, nullable) and
  `created_at timestamptz not null default now()`, plus an index on `repo_id`. No new table.
- "Rejected" = `accepted = false` (there is no status column); candidates start unaccepted.

## Flow (`POST /repos/:id/conventions/extract`)
1. Repo must be in the workspace (404) and cloned (`clone_path`, else 422 `repo_not_cloned`).
2. One extraction per repo at a time (in-process lock) → 409 `extraction_in_progress`.
3. Samples: `repoIntel.getConventionSamples(repoId, 12)` (ranked, no tests/configs/migrations);
   empty → 422 `index_not_ready`. Root configs (tsconfig, eslint, prettier, biome, editorconfig) are probed.
   Each file is read through `GitClient.readFile` (containment-checked) and capped at 8 000 chars.
4. One `completeStructured` call, `schemaName: ConventionExtraction`, model from Settings → Feature models →
   Conventions. Files are wrapped as `<untrusted source="path">`.
5. Verification (`modules/conventions/domain/verify.ts`, pure) keeps a candidate only if:
   its `evidence_path` is one of the files SENT; its snippet (≤ 1 500 chars) occurs in that file
   ignoring indentation / whitespace runs / blank lines (first and last lines may be partial);
   its rule (≤ 500 chars) is not a duplicate of another candidate or of an already-accepted rule.
   The matched line range is stored; confidence is clamped to 0..1 (percentages rescaled).
6. Re-scan replaces the repo's non-accepted rows in one transaction; accepted rows are kept.
7. The response carries the list plus `sampled_files`, `kept`, `dropped`, `model`, tokens and `cost_usd`
   (reported, not stored; null = unknown).

## API
| Method | Path | Behaviour |
|---|---|---|
| GET | `/repos/:id/conventions` | `ConventionList`: candidates (by confidence) + `last_scan_at` |
| POST | `/repos/:id/conventions/extract` | See Flow. 200 `ExtractConventionsResult` |
| PATCH | `/conventions/:id` | `{rule?, accepted?}` (at least one) → candidate; other workspace → 404 |
| POST | `/repos/:id/conventions/skill` | `{name, description, body, enabled?}` → 201 `Skill` with `type: convention`, `source: extracted`, `evidence_files` = accepted paths. No accepted → 422; duplicate name → 409 |

The skill body is drafted by the client from the accepted candidates and is fully editable before saving.

## Acceptance criteria
- `test/conventions.it.test.ts`: invented snippets and unsent files are dropped; lines/cost are reported;
  PATCH accept/edit; re-scan keeps accepted and skips duplicates; skill type/source/evidence_files;
  409 for a concurrent extract; 422 not-cloned / no-index; 404 across workspaces.
- `test/conventions-verify.test.ts`: snippet matching and candidate verification rules.

## Open questions
- Should accepted candidates be pinned to the skill they were saved into (re-sync the skill on edit)?
