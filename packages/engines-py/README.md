# @genesis/engines-py

The Python sidecar for GENESIS Studio. Wraps real scientific engines behind
a small HTTP API so the desktop app can call them.

## Zero dependencies

This service uses only Python's standard library (`http.server`, `json`,
`hashlib`). No `pip install` required. It runs on Python 3.8+ including
Python 3.14.

## Quick start

    cd packages/engines-py
    python server.py

The service listens on http://127.0.0.1:8765.

Open the desktop app. In the Flow sidebar, the Engine panel will show
`ThermoMPNNRunner` or `StubRunner` depending on what is installed.

## Enabling the real engine

ThermoMPNN requires PyTorch. PyTorch does not yet support Python 3.14.
You need a Python 3.11 or 3.12 environment.

    # Create a 3.12 venv (adjust the command to your system)
    py -3.12 -m venv .venv

    # Activate on Windows git bash:
    source .venv/Scripts/activate

    # Activate on Windows cmd:
    .venv\Scripts\activate.bat

    # Activate on macOS / Linux:
    source .venv/bin/activate

    # Install PyTorch and ThermoMPNN
    pip install torch thermompnn

    # Download the ThermoMPNN weights (see the ThermoMPNN repo)
    # Place thermoMPNN_weights.pt next to server.py

    # Fill in ThermoMPNNRunner.__init__ and ThermoMPNNRunner.predict
    # with the actual calls for your ThermoMPNN version.

    python server.py

The JS side needs no changes.
