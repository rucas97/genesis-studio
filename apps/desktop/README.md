# @genesis/desktop

The GENESIS Studio desktop shell. Three-tab layout. Play renders a real
PDB structure from RCSB.

## Run

    npm install
    npm run dev -w @genesis/desktop

Opens http://localhost:5173 in a browser.

## What this is

A shell, not a product.

- Three tabs (Play, Flow, Emergence). Emergence is disabled.
- Play loads PDB 4HJO (EGFR kinase domain) from RCSB and renders the CA
  trace as a rotating sphere-and-line mesh.
- Flow and Emergence are placeholders.

## What this is not

- Not offline. The PDB fetch requires network. Bundling a local PDB is
  the next step.
- Not interactive. You cannot grab, mutate, or manipulate the protein.
- Not wired to @genesis/engines or @genesis/ai yet.

## Roadmap

| Feature | Status |
|---|---|
| Three-tab layout | done |
| Real PDB rendering | done |
| Bundled local PDB (offline) | next |
| Residue picking + mutate | next |
| ΔΔG from @genesis/engines | next |
| AI card from @genesis/ai | next |
| Flow node canvas | Phase 1 |
