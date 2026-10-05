# GENESIS Studio — v1 Demo

**What this document is.** The 5-minute narrative that defines Phase 1.
It is the pitch, the technical spec, and the acceptance test. If the demo
runs end to end, Phase 1 is done. If it does not, Phase 1 is not done,
regardless of what else has been built.

**Scope discipline.** One protein. One mutation. One pipeline. One bridge.
Everything outside this document is Phase 2 or later.

---

## The demo, in five minutes

### 0:00 — The setup

A researcher opens GENESIS Studio. A single window. Three tabs at the top:
**Play**, **Flow**, **Emergence**. Emergence is greyed out — a small label
reads *"Phase 3."*

The researcher clicks **Play**.

### 0:30 — The sandbox

A protein rotates slowly in the center of the viewport. It is a real
structure — PDB 1TUP, the p53 DNA-binding domain, or similar. The
researcher grabs it with the mouse. It responds with weight.

A residue is highlighted. The researcher clicks it. A small keyboard
appears. They type `H`. The residue changes. A number appears next to
the protein: **ΔΔG = −2.1 kcal/mol**.

The AI co-scientist speaks — a small card in the corner:

> *R175H. Destabilizing. Four methods agree (ThermoMPNN, FoldX, Rosetta,
> ESM-1v). Confidence 0.87. Known pathogenic variant. This mutation is
> not novel — but the effect is reproducible.*

### 1:30 — Send to Flow

The researcher clicks **"Send to Flow."**

The view switches. A node canvas appears. It is already populated — four
nodes, connected:

    [Load p53] → [Apply R175H] → [Predict stability] → [Rank variants]

The AI says:

> *Generated from your Play session. Ready to run at scale.*

The researcher swaps the middle node: instead of one mutation, it loads a
list of 1,000 curated TP53 variants. They click **Run**.

### 2:30 — The pipeline runs

A progress bar. The nodes light up in sequence. Ten seconds later, the
results table populates. The top hit:

    Rank  Variant     ΔΔG (kcal/mol)  Confidence  Classification
    1     R273H       −3.4            0.91        Pathogenic
    2     R248Q       −3.1            0.89        Pathogenic
    3     R175H       −2.1            0.87        Pathogenic
    ...

The AI:

> *42 variants are flagged as likely destabilizing. Rank 1, R273H, is the
> most destabilizing in this set. It is a known DNA-contact mutant.*

### 3:30 — Send to Play

The researcher clicks on **R273H** → **"Send to Play."**

The view switches back. The protein appears, already mutated at position
273. The researcher grabs it. They rotate to the DNA-binding interface.
They see the mutation disrupt a contact with the DNA backbone.

They click the residue. A menu appears: **"Dock a ligand."**

They drag a small molecule from the library — a known p53 rescue compound.
It snaps into a pocket. A number appears: **Kd = 240 nM**.

The AI:

> *This compound binds near R273 but does not restore the lost contact.
> It is a partial rescue at best. Consider a covalent strategy.*

### 4:30 — Export the hypothesis

The researcher clicks **"Export hypothesis."**

A structured card appears — every field populated:

- **Claim:** R273H disrupts a direct DNA contact, reducing binding affinity by an estimated 4-fold.
- **Mechanism:** Loss of a charged contact with the DNA backbone at position 273.
- **Predictions:** (1) EMSA shows reduced DNA binding; (2) ITC Kd shifts from 12 nM to ~50 nM.
- **Confidence:** 0.89
- **Method agreement:** 4/4 methods
- **Novelty:** Known variant, mechanism partially characterized.
- **Falsification:** If ITC shows Kd < 20 nM, hypothesis is wrong.
- **Next experiment:** Express R273H, purify, run ITC against a 20-mer DNA oligo. Protocol attached. Primers designed.
- **Provenance:** Every action in this session is in the event log. Hash chain verified.

### 5:00 — The audit

The researcher clicks **"Verify session."**

A progress bar runs. One second later:

> *✓ Event log verified. 47 actions. Chain intact. Session reproducible.*

A button: **"Export session bundle."**

The demo ends.

---

## The acceptance test

Phase 1 is done when a fresh install, on a fresh machine, runs the demo
end to end without manual intervention, and:

| Step | Requirement | Measurable |
|---|---|---|
| 0 | App opens, three tabs visible | < 3 seconds |
| 1 | Load PDB 1TUP, render at 60 fps | < 2 seconds |
| 2 | Mutate a residue, get ΔΔG | < 2 seconds |
| 3 | Send to Flow generates a valid pipeline | < 1 second |
| 4 | Run 1,000 variants through a 4-node pipeline | < 60 seconds |
| 5 | Send top hit back to Play | < 1 second |
| 6 | Dock a ligand, get Kd | < 10 seconds |
| 7 | Export hypothesis card with all fields | < 2 seconds |
| 8 | Verify the session log | < 1 second |

If any row fails, Phase 1 is not done.

---

## What is deliberately NOT in v1

- Emergence Engine (Phase 3)
- Multiple tissues or diseases (Phase 3)
- Real-time full-atom refolding (Phase 2)
- MD simulation (Phase 2)
- Multiplayer (Phase 4)
- VR (Phase 4)
- Cloud sync (never, by design)
- CRISPR, splicing, base editing (Phase 2)
- Non-protein molecules (Phase 2)
- Any tool that would appear on the Flow canvas but not be exercised in
  the demo

If it is not in the acceptance test, it is not in v1.

---

## The honest limits of v1

1. **The refold is not real.** The visual change when mutating a residue is
   a coarse-grained representation. The ΔΔG is real. The refold is a
   stand-in for a full prediction and will be labeled as such in the UI.

2. **The variant set is curated.** The 1,000 variants in the pipeline are
   from ClinGen, not from a user's VCF. VCF import is Phase 2.

3. **The docking is a score, not a simulation.** DiffDock or a similar
   method gives the pose and the affinity. Real MD is Phase 2.

4. **The hypothesis card is structured, not reasoning.** The AI fills in a
   schema. It does not generate novel scientific prose yet. Structured
   reasoning is Phase 2. Real co-scientist behavior is Phase 3.

5. **One protein.** p53 is the demo. The library that ships is small. This
   is a proof, not a product.

---

## Why this demo is the right demo

Because it contains, in five minutes, every claim GENESIS is making:

- **Hands-on molecular play** — you grab, mutate, and watch the physics respond.
- **Play → Flow bridge** — a session of play becomes a reproducible pipeline.
- **Real scientific output** — ΔΔG values from real methods, not mock data.
- **Flow → Play bridge** — a pipeline result becomes a grabbable object.
- **AI co-scientist** — a structured, calibrated, falsifiable hypothesis.
- **Reproducibility** — the whole session, including the hand-work, is verified.

If it runs, GENESIS is real. If it does not, no amount of Emergence Engine
design will save it.

---

## What comes after v1

Once v1 runs, the build order is:

1. **Add MD** — one protein, one ligand, real physics, 10 ns. This makes
   Play genuinely interactive at atomic resolution for a small system.
2. **Add VCF import** — a user's variants flow into the pipeline. This makes
   the tool useful to real labs.
3. **Add CRISPR, splicing, base editing** — the toy shelf fills out.
4. **Begin the Emergence Engine** — one tissue, one disease model, short
   timescales. The first in silico observation of emergence.

Everything else is downstream of v1.

---

**v1 is one protein, one mutation, one pipeline, one bridge. Ship it.**

Research-use-only. Not a medical device.
