# Timeline severity popovers

## Goal
In a run row on the PR Timeline, the run's critical, warning and suggestion findings can be seen without scrolling to "Review runs".

## Behaviour
- A settled (`done`) run row shows a counter for CRITICAL findings (⊘ N, red) and one for WARNING findings (⚠ N, amber) and one for SUGGESTION findings (💡 N, suggestion colour), followed by "· N blockers".
- A counter is hidden when its count is 0. If neither counter is shown, the row falls back to the text "N finding(s)".
- Hovering or focusing a counter opens a popover with **only** the findings of that severity: severity badge, title, category, file:line, confidence, and a 2-line preview of the rationale.
- The popover stays open while the pointer moves from the counter into it. It closes on mouse-leave or Esc.
- The popover shows only a short preview. Clicking the counter jumps to the run's review accordion. Clicking a finding opens that accordion, expands that finding's card, and scrolls it to the center of the screen, where the full details are (rationale, suggested fix, actions).
  - If the finding is hidden by "Hide low confidence", that filter is turned off so the finding shows.
  - Collapsing the accordion clears the reveal request, so reopening it later doesn't scroll again.
- The data comes from the already-loaded `usePrReviews` findings (grouped by `run_id`), so there are no new API calls.

## Acceptance
Covered by `RunHistory.test.tsx` ("severity hover popovers").

## Severity filter pills (Review runs)
- The toolbar of each run's findings list shows a pill per severity that has findings, in order (e.g. "ⓘ 1 Critical", "⚠ 4 Warning").
- Counts follow "Hide low confidence": they count only the findings that filter leaves visible.
- Pills are independent toggles (multi-select). The list shows the union of the selected severities, and with no pill selected it shows everything. An active pill is painted in its severity's colour.
- Selected severities with no findings left (e.g. after turning on "Hide low confidence") are ignored.
- A reveal request from the Timeline popover for a finding whose severity isn't selected adds that severity to the selection.

## PR list FINDINGS column
- The PR list (`/repos/:repoId/pulls`) has a `FINDINGS` column between `SCORE` and `STATUS`, with the same critical / warning / suggestion counters and hover popovers.
- Counts come from the PR's **latest review round**: the newest review of **every** agent that ran on the PR, with older reruns of the same agent ignored. The counts of those reviews are summed. They arrive with the list in `PrMeta.latest_round` (`{ review_ids, critical, warning, suggestion }`, computed by the server with `latestReviewPerAgent` + `rollupSeverities`). `SCORE` is still the single latest review.
- The findings themselves are fetched only when a popover opens (`GET /pulls/:id/reviews`, then the reviews listed in `latest_round.review_ids`). While they load, the popover shows "Loading findings…".
- Never-reviewed PR → "—". Latest review with no findings → "0".
- Clicking a counter opens `…/pulls/:number?tab=findings` (the round spans several runs). Clicking a finding opens `?tab=findings&run=<the run that produced it>&finding=<id>`; `FindingsTab` reads these params as its initial target, then expands and scrolls to the finding.
- The table card is `overflow: visible`, so a popover under the last row isn't clipped.

Covered by `PrFindingsCell.test.tsx`.
