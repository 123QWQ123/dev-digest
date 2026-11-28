# M2 — Conventions Extractor (client)

## Goal
A per-repo page that runs the Conventions Extractor, lets the user accept / reject / edit each
candidate, and saves the accepted ones as one `convention` skill through a review modal.
Backend: `server/specs/m2-conventions.md`.

## Screens
1. **Sidebar**: `Conventions` under SKILLS LAB → `/repos/:repoId/conventions` (`g c`). The active key
   comes from `app-shell/helpers.ts` (`/conventions` in the path).
2. **Conventions page** (`app/repos/[repoId]/conventions`):
   - Header "Conventions in **repo**" + "N candidates · grounded against sampled files · last scan 1h ago";
     **Re-scan** (shows "Scanning…", disabled while running).
   - Empty state with **Run extraction**. After a scan a toast reports kept / dropped / files / cost / model.
   - Toolbar: **Accept all** / **Deselect all**, "N of M accepted", primary **Create skill**
     (disabled while nothing is accepted).
   - **ConventionCard**: italic rule with a pencil (inline Textarea, Save / Cancel, ≤ 500 chars);
     evidence box `path:start-end` + copy button + snippet; confidence bar (green ≥ 85 %, amber ≥ 65 %);
     **Accept** / **Accepted** (primary) and **Reject** (enabled only when accepted). Accepted cards get a
     green left border; "rejected" = not accepted (no separate state).
3. **Create skill from conventions** modal: info banner "Merged from N accepted conventions in repo",
   the shared `SkillForm` (moved to `components/skills/`) prefilled by `buildSkillDraft`:
   name `<repo>-conventions`, description "N house conventions extracted from repo", body
   `# name` + intro + one `## <rule-slug>` section per rule with "Detected in `path:lines`" and a fenced
   snippet. Type is locked to `convention`. **Create skill** → `POST /repos/:id/conventions/skill`;
   409 (name taken) shows as an error toast and the modal stays open.

## Data
- Hooks `lib/hooks/conventions.ts`: `useConventions`, `useExtractConventions` (writes the list cache),
  `useUpdateConvention` (optimistic, rolled back on error), `useCreateConventionSkill` (invalidates skills).
- Key `queryKeys.conventions(repoId)`.

## Linking to an agent
Unchanged: open the agent → Skills tab → tick the new skill. Extracted skills carry the
"untrusted" badge like imported ones (`isUntrusted`: source ≠ manual).

## Acceptance criteria
- `helpers.test.ts`: slugs, evidence refs, default name, draft body (fence/language, slug dedupe, body cap).
- `ConventionCard.test.tsx`, `ConventionsView.test.tsx`, `CreateConventionsSkillModal.test.tsx`.
