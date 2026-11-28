# M2 — Skills in the prompt (reviewer-core)

## Goal
Render linked skills into the prompt in a form the model can attribute and the trace can show
block by block.

## Scope / Non-goals
- In: the `formatSkill(name, body)` export; tests for the `skills` slot.
- Out: moving skills into the system message. They stay in the user message, so the
  `INJECTION_GUARD` ordering is unchanged. Out too: wrapping skills as untrusted. A skill is meant to
  instruct the model; trust is handled upstream by preview, confirmation and the untrusted badge.

## Behaviour
- `formatSkill(name, body)` → `### <name>\n\n<body trimmed>`.
- `ReviewInput.skills` stays `string[]` (already-formatted blocks). The server resolves and formats them.
- `assemblePrompt` puts the blocks, joined with blank lines, under `## Skills / rules` in the user
  message, after the PR description, in the order given.
- An absent or empty `skills` leaves the prompt byte-identical to a run without skills.

## Acceptance criteria
- A test checks that the skills block appears in order, inside the user message, and not in the system message.
- A test checks that `skills: []` and `skills: undefined` produce the same prompt.
