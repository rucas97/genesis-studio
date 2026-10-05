# @genesis/shared

The single source of truth. Play, Flow, and Emergence all read and write here.

## Contents

- `models/` — Project, Molecule, Variant, Hypothesis, Run
- `state/` — State container, selectors, reducers
- `events/` — Event log, replay, subscriptions
- `audit/` — SHA-256 hash-chained audit log

## Rule

No mode owns state. Every mode proposes events. The state is derived.
