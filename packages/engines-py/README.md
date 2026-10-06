# @genesis/engines-py

The Python sidecar for GENESIS Studio. Stdlib-only HTTP service that
optionally wraps real scientific engines.

## What runs

| Endpoint | Stub runner | Real runner | Requirement |
|---|---|---|---|
| POST /predict_stability | StubStabilityRunner | ThermoMPNNRunner | torch + thermompnn in a 3.11/3.12 venv |
| POST /dock | StubDockingRunner | VinaDockingRunner | vina and obabel on PATH |

The active runner is reported by `GET /health`. The UI reads this and
tells the truth about which is running.

## Quick start (stub only, no dependencies)

    python server.py

Works on any Python 3.8+ including 3.14.

## Real engines

    bash scripts/setup-thermompnn.sh

This installs `uv`, creates a Python 3.12 venv in `.venv/`, and installs
torch + thermompnn. Then download the ThermoMPNN weights from the release
page and place them next to `server.py`. Activate the venv and run:

    source .venv/Scripts/activate    # Windows git bash
    # or: source .venv/bin/activate  # Unix
    python server.py

## AutoDock Vina

Vina needs a native binary and Open Babel for PDBQT conversion.

    # Linux/mac
    conda install -c conda-forge vina openbabel

    # Windows
    https://vina.scripps.edu/downloads/
    https://openbabel.org/

Both `vina` and `obabel` must be on PATH.

## Endpoints

### GET /health
Returns the active runner names and versions.

### POST /predict_stability
Body: `{ "pdbId": "4HJO", "variant": { "hgvs": "p.L858R", ... } }`

Response: `{ deltaDeltaG, deltaDeltaGCI, method, methodVersion, notes }`

### POST /dock
Body:
```json
{
  "pdbId": "4HJO",
  "ligandId": "atp",
  "ligandSmiles": "C1=NC(=C2C(=N1)N(C=N2)C3C(...)",
  "center": { "x": 12.3, "y": -4.5, "z": 8.1 },
  "boxSize": 22,
  "ligandPoint": { "x": 12.0, "y": -4.0, "z": 8.5 }
}Response: { distanceAngstrom, estimatedKdNm, bindingEnergyKcal, method, methodVersion, notes }

bindingEnergyKcal is null for the stub. For Vina, it is the top-ranked
pose energy in kcal/mol. Kd is derived from the standard relationship
dG = R T ln(Kd) at 298.15 K.
