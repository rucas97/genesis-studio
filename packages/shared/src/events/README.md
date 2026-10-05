# EventLog

Append-only, SHA-256 hash-chained, replayable, tamper-evident log of every
action in a project.

## Why it exists

Play is normally not reproducible. Interactive exploration is thrown away.
The EventLog fixes that: every grab, mutation, splice, and simulation step
is an Action, and every Action is chained to the previous.

A third party with the same log and the same engine versions reconstructs
the same session. A curator, an accreditation body, or a court can verify
that nothing was altered after the fact.

## Properties proved by tests

| Property | Test |
|---|---|
| Append-only, chain integrity | `EventLog.test.ts > append` |
| Tamper detection (payload) | `verify > detects a tampered payload` |
| Tamper detection (timestamp) | `verify > detects a tampered timestamp` |
| Tamper detection (hash) | `verify > detects a tampered hash` |
| Tamper detection (chain) | `verify > detects a broken chain link` |
| Tamper detection (deletion) | `verify > detects a removed action in the middle` |
| Tamper detection (reorder) | `verify > detects reordered actions` |
| Canonical hashing (key order) | `canonical hashing` |
| Deterministic replay | `replay > replays a log deterministically` |
| Cross-system reproducibility | `the reproducibility claim` |

## The reproducibility claim

Two independent EventLogs, given the same actions in the same order, produce
byte-identical hash chains. That is what makes a session citable.

## What the log does NOT prove

- It does not prove the *science* is correct.
- It does not prove the *engine* is accurate.
- It proves only that the record has not been altered since it was written.

That is the honest claim. It is enough.
