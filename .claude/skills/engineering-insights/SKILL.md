---
name: engineering-insights
description: Captures non-obvious engineering insights into the touched module's INSIGHTS.md (client, server, reviewer-core, e2e). Use during a session the moment you hit something a future agent would otherwise relearn — a gotcha, a working approach, a dead-end antipattern, a codebase convention, a tool/library quirk, a recurring error+fix, or an open question — and again at session end, on "wrap up" / "retro", or when /engineering-insights is invoked. Reads the existing file first, never duplicates, writes only substantial file-grounded entries, and is strictly append-only (never overwrites).
---

# Engineering Insights

Capture one durable engineering insight into the **INSIGHTS.md of the module the work touched**, so the next
session doesn't relearn it. Read what's already there, add only what's new and substantial, never overwrite.

## Where to write (module routing)

Write to the file of the package the work actually touched:

| Work touched | File |
|---|---|
| client (`@devdigest/web`) | `client/INSIGHTS.md` |
| server (`@devdigest/api`, incl. repo-intel) | `server/INSIGHTS.md` |
| reviewer-core (`@devdigest/reviewer-core`) | `reviewer-core/INSIGHTS.md` |
| e2e (`@devdigest/e2e`) | `e2e/INSIGHTS.md` |

Several packages touched → write to the one where the root cause / fix lives. Never write to a package the work didn't touch.

## Which section

| Insight | Section |
|---|---|
| Approach that worked and should be repeated | What Works |
| Dead end, failed approach, antipattern — **the most valuable, don't skip** | What Doesn't Work |
| Convention or architectural decision with its reason | Codebase Patterns |
| Quirk of a dependency, tool or doc | Tool & Library Notes |
| Error that can recur + its fix | Recurring Errors & Fixes |
| One-line summary of a session that produced entries | Session Notes |
| Unresolved, needs investigation | Open Questions |

## Workflow

Copy this checklist and work through it:

```
- [ ] 1. Gate check — was this session substantial?
- [ ] 2. Read the touched module's INSIGHTS.md
- [ ] 3. Draft ≤5 candidates, ranked by signal
- [ ] 4. Dedup against what's already there
- [ ] 5. Append automatically (append-only)
- [ ] 6. One-line summary
```

1. **Gate check.** Did the session produce something substantial — a problem solved, a decision made, a non-obvious
   discovery? Trivial edits (config tweaks, typos, renames) don't count. If not → **write nothing** and stop.
2. **Read first.** Open the touched module's `INSIGHTS.md` before drafting anything.
3. **Draft ≤5 candidates**, ranked by signal (user corrections and gotchas highest; nice-to-know patterns lowest).
   A candidate = the exact proposed line + its target section + `file:line` evidence. Each must pass the substance
   test: a future agent would go wrong without it, and it is NOT obvious from the code, README or CLAUDE.md.
4. **Dedup.** Drop any candidate already covered by an existing entry (same cause or same fix, even worded
   differently). If reality contradicts an old entry, add a new one that supersedes it — never edit the old one.
5. **Append** the survivors (automatic mode — no approval prompt). If nothing substantial survives gate + dedup,
   write nothing. Something substantial survived → recording it is mandatory, plus one Session Notes line.
6. **Summary.** One line to the user: what was written, to which file, what was skipped — so they can spot-check
   (entries are a draft, not truth).

Entry format: `- YYYY-MM-DD · <specific lesson> — <why / fix> (`path:line`)`

## Non-destructive write contract (hard rule)

This skill is **append-only** and must never clobber existing content:

- **Re-read the target `INSIGHTS.md` immediately before writing** — its state may have changed since step 2
  (another session, a teammate's merge, the user's manual edit).
- **Insert, never rewrite.** Use a targeted Edit that adds the bullet at the end of its section. Never use Write
  on an existing INSIGHTS.md, never regenerate the file from memory.
- **Never edit, reorder or delete** existing entries, the header comment or the section headings — even to fix typos.
- **Contradictions:** append `Supersedes <date>: …` and point the conflict out to the user in the summary.
- **Missing section** → append the heading at the end of the file; never restructure the file.
- **Verify:** after writing, `git diff <file>` must show only added lines (`+`). Any `-` line → you clobbered
  something: restore it immediately and tell the user.

## Quality: actionable cold

The reader must know what to do without digging. Name the file, command, value.

- ❌ "Be careful with async." — noise
- ❌ "Jobs can fail." — noise
- ✅ "Fire-and-forget `jobs.enqueue()` without a rejection handler kills the API on a failed job — the catch lives in `JobRunner.enqueue` (`src/platform/jobs.ts:104`)"

## Rules

- **Size.** File over ~200 entries → tell the user to prune or split into domain files (`INSIGHTS-<domain>.md`).
- **Not here:** a rule every session needs → propose it for the package CLAUDE.md instead.
