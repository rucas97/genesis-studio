# @genesis/desktop

The GENESIS Studio desktop shell. Three-tab layout. Play renders a real
PDB structure. Flow runs a stub-engine pipeline. Both share one event log.

## Setup

    npm install
    bash scripts/fetch-pdb.sh 4HJO     # optional, primes the offline cache
    npm run dev -w @genesis/desktop

Opens http://localhost:5173.

## What works

- **Play** — PDB 4HJO (EGFR kinase domain). Click any CA sphere to pick a
  residue. Type a new amino acid, click Apply. The picked sphere turns
  yellow, the mutated sphere turns orange-red, and the sidebar shows a
  ΔΔG, an AI observation, and a falsifiable hypothesis. Every action is
  written to the shared event log.
- **Flow** — 4-node pipeline (Load EGFR → Curated variants → Predict
  stability → Rank). Run it, get a ranked table of 25 variants. Each row
  has a **Send to Play** button that switches tabs and preloads the
  variant in the sandbox.
- **Shared log** — Play and Flow write to the same EventLog. The action
  count and Verify button live in the top bar and cover the whole session.
- **Offline PDB** — the loader tries a bundled copy first, then RCSB. The
  overlay says which source was used.

## What does not work yet

- Emergence tab is a placeholder (Phase 3).
- Node editing in Flow (adding, removing, connecting nodes) is Phase 2.
- The engine and co-scientist are stubs. The UI says so.
- VCF import is Phase 2.

## Offline mode

The app tries `apps/desktop/public/<pdbId>.pdb` first. To prime the
cache, run the fetch script once with network:

    bash scripts/fetch-pdb.sh 4HJO

Then the demo runs without network.
