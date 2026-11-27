---
name: flaky-test-patterns
description: Use when tests in the diff touch time, timers, async ordering, shared state or the network. Flag patterns that make a test pass or fail nondeterministically.
type: custom
---
# Flaky test patterns

Flag a test as WARNING when it depends on something it does not control:

- **Real time**: `Date.now()`, `new Date()` or `setTimeout` without fake timers
  (`vi.useFakeTimers()` / `vi.setSystemTime()`).
- **Sleeps as synchronisation**: `await sleep(100)` / fixed waits instead of
  awaiting the event, promise or `waitFor` condition.
- **Order dependence**: a test that only passes after another test ran, or
  shared module-level state that is not reset in `beforeEach`/`afterEach`.
- **Unordered results**: asserting on the order of a DB query without
  `ORDER BY`, or of `Promise.all` side effects.
- **Real network / ports**: hard-coded ports, calls to real HTTP endpoints.
- **Randomness**: `Math.random()`/UUIDs in assertions without a seed or stub.

Name the exact line and the nondeterministic input, and suggest the
deterministic replacement.
