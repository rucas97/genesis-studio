# GENESIS Studio — v1 Demo

**What this document is.** The 5-minute narrative that defines Phase 1.
It is the pitch, the technical spec, and the acceptance test. If the demo
runs end to end, Phase 1 is done.

**Scope discipline.** One protein. One mutation. One pipeline. One bridge.

---

## The demo, in five minutes

### 0:00 — The setup

A researcher opens GENESIS Studio. Three tabs: **Play**, **Flow**,
**Emergence**. Emergence is greyed out — a small label reads *"Phase 3."*

They click **Play**.

### 0:30 — The sandbox

The EGFR kinase domain rotates in the viewport. PDB 4HJO. The researcher
grabs it. It responds with weight. They click residue 858. A small keyboard
appears. They type `R`. Leucine becomes arginine. A number appears:
**ΔΔG = −1.8 kcal/mol**.

The AI co-scientist:

> *L858R. Activating mutation in EGFR. Destabilizing by 1.8 kcal/mol
> (stub, not for scientific use). This is a known driver mutation in
> NSCLC. The structural basis of activation is still debated.*

### 1:30 — Send to Flow

They click **"Send to Flow."** A node canvas appears, already populated:

    [Load EGFR] → [Apply L858R] → [Predict stability] → [Rank variants]

The AI: *"Generated from your Play session. Ready to run at scale."*

They swap the middle node to load 1,000 curated EGFR variants and click **Run**.

### 2:30 — The pipeline runs

Ten seconds later, the results table populates. Top hits:

    Rank  Variant     ΔΔG (kcal/mol)  Classification
    1     L858R       −1.8             Activating
    2     T790M       −2.1             Resistance
    3     C797S       −0.9             Resistance
    ...

The AI: *"42 variants flagged. T790M is the gatekeeper resistance mutation.
C797S blocks covalent inhibitors."*

### 3:30 — Send to Play

They click **T790M** → **"Send to Play."** The mutated protein appears,
already at position 790. They rotate to the ATP pocket. They see the
methionine side chain occlude the drug-binding site. They drag erlotinib
from the library. It cannot enter. Kd = no binding detected.

The AI: *"This is the mechanism of first-generation TKI resistance. Third-
generation inhibitors were designed to fit past the methionine gate."*

### 4:30 — Export the hypothesis

They click **"Export hypothesis."** A structured card appears:

- **Claim:** T790M occludes the ATP pocket via steric bulk, preventing
  first-generation TKI binding.
- **Mechanism:** Methionine substitution at the gatekeeper position blocks
  the hydrophobic pocket occupied by aniline-containing inhibitors.
- **Predictions:** (1) Erlotinib binding undetectable by ITC; (2) Osimertinib
  restores binding.
- **Confidence:** 0.91
- **Method agreement:** 4/4
- **Novelty:** Known mechanism, well characterized.
- **Falsification:** If ITC shows measurable erlotinib binding, hypothesis is wrong.
- **Next experiment:** Express T790M, purify, run ITC against erlotinib and
  osimertinib. Protocol attached.
- **Provenance:** Every action in the session is in the event log.

### 5:00 — The audit

They click **"Verify session."** The session replays — every action, in
order, in five seconds. Then:

> *✓ Event log verified. 47 actions. Chain intact. Session reproducible.*

They click **"Export session bundle."** Demo ends.

---

## The acceptance test

Phase 1 is done when a fresh install, on a fresh machine, runs the demo
end to end without manual intervention, and:

| Step | Requirement | Measurable |
|---|---|---|
| 0 | App opens, three tabs visible | < 3 seconds |
| 1 | Load PDB 4HJO, render at 60 fps | < 2 seconds |
| 2 | Mutate a residue, get ΔΔG | < 2 seconds |
| 3 | Send to Flow generates a valid pipeline | < 1 second |
| 4 | Run 1,000 variants through a 4-node pipeline | < 60 seconds |
| 5 | Send top hit back to Play | < 1 second |
| 6 | Dock a ligand, get Kd | < 10 seconds |
| 7 | Export hypothesis card with all fields | < 2 seconds |
| 8 | Verify the session log | < 1 second |

---

## What is deliberately NOT in v1

- Emergence Engine (Phase 3)
- Multiple tissues or diseases (Phase 3)
- Real-time full-atom refolding (Phase 2)
- MD simulation (Phase 2)
- Multiplayer, VR (Phase 4)
- Cloud sync (never, by design)
- CRISPR, splicing, base editing (Phase 2)

If it is not in the acceptance test, it is not in v1.

---

## The honest limits of v1

1. **The refold is not real.** The visual change when mutating a residue
   is a coarse-grained representation. The ΔΔG is real once the engine is
   real; in v1 it is a stub.

2. **The variant set is curated.** 1,000 variants from ClinGen, not a
   user's VCF. VCF import is Phase 2.

3. **The docking is a score, not a simulation.** DiffDock or similar.
   Real MD is Phase 2.

4. **The hypothesis card is structured, not reasoning.** The AI fills a
   schema. Real co-scientist behavior is Phase 3.

5. **One protein.** EGFR is the demo. This is a proof, not a product.

---

**v1 is one protein, one mutation, one pipeline, one bridge. Ship it.**

Research-use-only. Not a medical device.
