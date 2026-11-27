# Finding schema (subagent output contract)

A skill-review subagent's final message is **one JSON object and nothing else** (no prose, no code fence):

```json
{
  "skill": "onion-architecture",
  "status": "ok",
  "findings": [
    {
      "file": "server/src/modules/pulls/routes.ts",
      "line": 42,
      "severity": "critical",
      "rule": "onion-routes-only-call-services",
      "evidence": "import { db } from '../../db/client' — route queries the DB directly",
      "fix": "Move the query into PullsRepository and call it through PullsService (compose.ts).",
      "confidence": "high"
    }
  ]
}
```

| Field | Rules |
|---|---|
| `file` | Repo-relative path. It **must** be one of the files the subagent was given. Findings on other files are dropped |
| `line` | 1-based line in the **new** version of the file (the snapshot, not the base) |
| `severity` | `critical` \| `major` \| `minor`, per `severity-rubric.md` |
| `rule` | Stable id: the rule's id from the skill if it has one (e.g. onion `[onion-orm-only-in-infra]`). Otherwise a kebab-case slug of the rule heading (`no-derived-state-in-effect`). Suppressions match on it, so keep it stable |
| `evidence` | The offending code, quoted, plus one sentence on why it breaks the rule |
| `fix` | A concrete change, not "consider improving" |
| `confidence` | `high` \| `medium`. A critical must be `high` |

`"findings": []` is a valid, good answer. If the review could not be done (files unreadable, etc.):
`{"skill": "...", "status": "error", "error": "<why>", "findings": []}`.

## Orchestrator additions (before `finalize`)

The orchestrator merges every subagent's object into one file:

```json
{ "results": [ { "skill": "...", "status": "ok", "findings": [ ... ] }, ... ] }
```

and, for **every critical**, re-reads the code at `file:line` and sets `"verified": true` if the problem
is real. It downgrades or removes the critical otherwise. `finalize` turns any critical without
`verified: true` into a major.
