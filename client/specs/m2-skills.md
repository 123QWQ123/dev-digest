# M2 — Skills (client)

## Goal
Manage reusable skills (create, edit, version, import) and attach them to agents.
The backend is described in `server/specs/m2-skills.md`.

## Screens
1. **Sidebar**: a new **SKILLS LAB** section with `Skills` (`/skills`, `g s`) and `Agents`.
2. **Skills page** (`/skills`, `/skills/[id]`):
   - Left column: search, plus an **Add Skill ▾** dropdown with Create skill / Import from file.
   - Each card shows the name, a coloured type badge, the description, the source, `N agents`,
     and an enabled `Toggle`.
   - Right side: the selected skill's detail with tabs:
     - **Config**: name, description, type, body (mono textarea with a char count),
       optional version note, and Save. Under the description: *"This is the skill's interface:
       write it as a directive (e.g. "Use when… Flag…")."*
     - **Preview**: "Preview" title + hint, then the markdown body in a card (`PreviewTab`; prose
       typography is scoped to `.skill-prose` in `globals.css`, because Tailwind preflight strips
       heading sizes and list bullets). Skills with `source !== manual` get a
       "Imported — untrusted" badge and notice.
     - **Stats**: tiles Used by / Pull frequency / Accept rate (ring) / Findings (30d); "Agents using
       this skill" with Open links; "Findings by category" donut (counts). Footnote explains attribution.
     - **Versions**: version history (vN, note, date, Current), a Diff modal (line diff against
       the current version) and Restore.
3. **Import drawer**: pick a `.md` or `.zip` file, then the server preview loads.
   - Name, description, type and body are editable.
   - Shows the list of ignored files, any warnings, and a trust banner.
   - **Save skill** is the only action that persists anything.
4. **Agent editor → Skills tab**:
   - Header "N of M enabled", a filter, and the order hint.
   - Rows: drag handle, ↑/↓ buttons, checkbox, name, type badge. A skill that is disabled
     globally is not listed; its link and tick are kept, so it is active again once re-enabled.
   - Linked skills come first, in order; unlinked skills follow.
   - Ticking a checkbox links the skill (enabled); unticking keeps the link but disables it.
     Every change saves immediately.
5. **Agent card**: a `N skills` badge and a 30-day line `N runs · X% accept · $Y avg`.
   Skill card: `N agents · X% pull · Y% accept` and a source icon.
6. **Agent editor → Stats tab**: Runs (30d), Accept rate, Avg cost, Avg latency; findings by severity
   bars; review-score trend of the last runs.
7. **Prompt editor** (skill body, agent system prompt): file-style header with name, `unsaved` badge
   and a live server-side token count (agent: `N / 8,000 tokens` soft budget), plus line numbers.
8. **Run trace**: the Skills section lists `skills_used` (name vN); each prompt slot shows its token count.

## Non-goals
- The Evals tabs, "Run on evals" and the agent CI tab (M6 eval pipeline); markdown syntax
  highlighting in the editor; import from URL or community.

## Acceptance criteria
- A skill can be created, edited, versioned, restored and toggled from the UI.
- An import goes through the preview; nothing is saved before the user confirms.
- On the Skills tab, checking, unchecking and reordering saves, and the order sticks after a reload.
- Tests: `SkillsTab.test.tsx`, `ImportSkillDrawer.test.tsx`, skill `StatsTab.test.tsx`,
  `PromptEditor.test.tsx`, stats/latency helpers, and skill keys in `keys.test.ts`.
