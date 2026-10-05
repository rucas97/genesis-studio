# @genesis/engines

Scientific engines. Every engine wraps a real tool or a stub, and every
engine satisfies the `StabilityEngine` contract in `src/types.ts`.

## Design rule

> Build the interface. Stub the implementation. Ship the demo. Then upgrade.

The v1 demo does not need a real prediction engine. It needs a real
interface and a stub that returns deterministic values. When the demo runs,
swapping the stub for ThermoMPNN is a one-line change in the registry.

## What lives here

- `src/types.ts` — the engine contract. Every prediction carries an
  uncertainty band. This is not optional.
- `src/registry.ts` — where engines are registered and looked up.
- `src/physics/StubStabilityEngine.ts` — deterministic stub for the demo.
- `src/physics/` — future home of ThermoMPNN, ESM-1v, FoldX wrappers.

## The rules

1. **Every prediction carries an uncertainty band.** No exceptions.
2. **Every engine self-reports what it can and cannot do.** The
   `capabilities()` method exists so the AI co-scientist knows when an
   engine is out of its depth.
3. **Every engine records its version.** Reproducibility is structural.
4. **Stubs are labeled as stubs.** The `validationScope` field says so.
   If it is not real science, the code says so in the open.

## Roadmap

| Engine | Status | Notes |
|---|---|---|
| Stub | registered | Demo only |
| ThermoMPNN | planned | Real ΔΔG, needs Python + PyTorch |
| ESM-1v | planned | Zero-shot, fast, no training |
| FoldX | planned | License required for commercial use |
| Rosetta ddG | later | Slow, high accuracy |
