"""
GENESIS Studio — engine sidecar.

Zero dependencies. Uses only Python's standard library so it runs on any
Python 3.8+ including 3.14, no venv required, no pip install required.

Run:
    python server.py

Then start the desktop app. The Flow sidebar will show which runner is
active. Real numbers only appear when ThermoMPNN is installed — see
ThermoMPNNRunner below.

Endpoints:
    GET  /health             -> { status, runner, version }
    POST /predict_stability  -> { deltaDeltaG, deltaDeltaGCI, method, ... }
"""

from __future__ import annotations

import hashlib
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Runners
# ---------------------------------------------------------------------------

class StubRunner:
    """Deterministic placeholder. Not science. Used when ThermoMPNN is absent."""

    name = "StubRunner"
    version = "0.0.1"

    def predict(self, pdb_id: str, variant: Dict[str, Any]) -> Dict[str, Any]:
        key = f"{pdb_id}|{variant.get('hgvs', '')}".encode()
        h = int(hashlib.sha256(key).hexdigest()[:8], 16)
        t = (h % 10000) / 10000.0
        ddg = -4.0 + t * 4.5
        band = 0.25 + ((h >> 8) % 1000) / 1000.0 * 0.55
        return {
            "deltaDeltaG": round(ddg, 2),
            "deltaDeltaGCI": [round(ddg - band, 2), round(ddg + band, 2)],
            "method": "Stub (sidecar)",
            "methodVersion": self.version,
            "notes": "Stub runner. Install ThermoMPNN for real predictions.",
        }


class ThermoMPNNRunner:
    """
    Real ThermoMPNN runner.

    Requires:
        pip install torch thermompnn

    IMPORTANT: use a Python 3.11 or 3.12 environment, NOT 3.14. PyTorch
    and PyO3 do not yet support 3.14.

    Weights: download thermoMPNN_weights.pt and place next to this file.

    The exact call signature of ThermoMPNN has changed across releases.
    Fill in the two hook points below to match your installed version.
    """

    name = "ThermoMPNNRunner"
    version = "1.0.0"

    def __init__(self) -> None:
        import torch  # noqa: F401
        import thermompnn  # noqa: F401

        # Load the model once. Adjust paths to your install.
        # Example (adapt to your ThermoMPNN version):
        #   from thermompnn.inference import load_model
        #   self.model, self.config = load_model("thermoMPNN_weights.pt")
        self.model = None
        self.config = None

    def predict(self, pdb_id: str, variant: Dict[str, Any]) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError(
                "ThermoMPNN model not loaded. See ThermoMPNNRunner.__init__."
            )
        # Placeholder for the real call. Adapt to your ThermoMPNN version:
        #   result = self.model.predict(pdb_id, variant["hgvs"])
        #   ddg = float(result.ddg)
        raise NotImplementedError(
            "Plug the real ThermoMPNN call into ThermoMPNNRunner.predict."
        )


def pick_runner():
    try:
        return ThermoMPNNRunner()
    except Exception:
        return StubRunner()


RUNNER = pick_runner()


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # CORS: allow the Vite dev server.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send_json(
                200,
                {"status": "ok", "runner": RUNNER.name, "version": RUNNER.version},
            )
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/predict_stability":
            self._send_json(404, {"error": "not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            body = json.loads(raw)
            pdb_id = body["pdbId"]
            variant = body["variant"]
            result = RUNNER.predict(pdb_id, variant)
            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def log_message(self, fmt: str, *args: Any) -> None:
        # Quieter logging.
        print(f"[sidecar] {fmt % args}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    host = "127.0.0.1"
    port = 8765
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"GENESIS engine sidecar listening on http://{host}:{port}")
    print(f"Runner: {RUNNER.name} v{RUNNER.version}")
    if isinstance(RUNNER, StubRunner):
        print("  Note: stub runner. Install ThermoMPNN for real predictions.")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
