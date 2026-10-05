# @genesis/shared

The single source of truth. Play, Flow, and Emergence all read and write here.

## Principle

Every mode proposes **Actions**. The **EventLog** is the ordered, hash-chained
sequence of all Actions. **ProjectState** is a projection of the log.

No mode owns state. The state is derived.

This is what makes a Play session reproducible: the actions taken by hand are
recorded in the same log as pipeline runs and simulation steps.

## Contents

| Path | What it holds |
|---|---|
| `src/models/` | Project, Molecule, Variant, Run, Hypothesis, Action |
| `src/events/` | EventLog (append-only, hash-chained, replayable) |
| `src/state/` | ProjectState, reducer |

## Rules

1. IDs are branded types. Do not pass a `MoleculeId` where a `VariantId` is expected.
2. Actions are immutable once appended. To "undo," append a compensating action.
3. Every Run records `toolVersion` and `inputHash`. Reproducibility is structural, not aspirational.
4. Every Hypothesis carries calibrated uncertainty and a falsification statement. No exceptions.

## Why this design

Play and Flow are different UIs over the same data. If the data model is right,
the bridges between modes are trivial state transitions. If it is wrong, no
amount of UI polish will fix it.

This package is the decision everything else waits on.
