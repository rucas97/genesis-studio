# Architecture

## Three modes, one state

GENESIS is one application with three views over a shared project state.

    Play  <---->  Shared State  <---->  Flow
                        ^
                        |
                   Emergence

Bridges are state transitions, not data conversions. One event log records every action in every mode.

## Packages

| Package | Responsibility |
|---|---|
| `packages/shared` | Data models, state, event log, hash-chained audit |
| `packages/play` | 3D molecular sandbox |
| `packages/flow` | Node canvas and pipeline execution |
| `packages/emergence` | Multi-scale simulation engine |
| `packages/ai` | AI co-scientist: watcher, ensemble, novelty, hypothesis |
| `packages/engines` | Scientific engines: physics, folding, docking, MD, pathways |
| `packages/ui` | Shared UI components |

## The critical decision

Get the shared data model right before writing UI code. Everything else follows.

## Acceleration layer

Emergence uses hybrid physics + ML: neural surrogates for speed, physics constraints for rigor.
