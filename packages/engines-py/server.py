"""
GENESIS Studio engine sidecar.

Zero dependencies. Uses only the standard library.

Run:
    python server.py

Endpoints:
    GET  /health             -> { status, runner, version }
    POST /predict_stability  -> { deltaDeltaG, deltaDeltaGCI, method, ... }
    POST /dock               -> { distanceAngstrom, estimatedKdNm, method, ... }
"""

from __future__ import annotations

import hashlib
import json
import math
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict


class StubStabilityRunner:
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
            "notes": "Stub runner. Not for scientific use.",
        }


class StubDockingRunner:
    name = "StubDocking"
    version = "0.0.1"

    def dock(self, body: Dict[str, Any]) -> Dict[str, Any]:
        dx = body["ligandX"] - body["proteinX"]
        dy = body["ligandY"] - body["proteinY"]
        dz = body["ligandZ"] - body["proteinZ"]
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)
        optimal = 3.5
        sigma = 1.5
        score = math.exp(-((distance - optimal) ** 2) / (2 * sigma * sigma))
        kd_nm = 10.0 * math.pow(10000.0, 1.0 - score)
        return {
            "distanceAngstrom": round(distance, 2),
            "estimatedKdNm": round(kd_nm, 2),
            "method": "Sidecar geometric stub",
            "methodVersion": self.version,
            "notes": "Geometric estimate from atom distance. Not a real docking score.",
        }


class ThermoMPNNRunner:
    name = "ThermoMPNNRunner"
    version = "1.0.0"

    def __init__(self) -> None:
        import torch  # noqa: F401
        import thermompnn  # noqa: F401
        self.model = None
        self.config = None

    def predict(self, pdb_id: str, variant: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError(
            "Plug the real ThermoMPNN call into ThermoMPNNRunner.predict."
        )


class VinaDockingRunner:
    """Real AutoDock Vina docking. Requires vina installed and on PATH."""

    name = "VinaDocking"
    version = "1.0.0"

    def __init__(self) -> None:
        import subprocess
        try:
            subprocess.run(["vina", "--version"], capture_output=True, check=False, timeout=5)
        except FileNotFoundError:
            raise ImportError("vina not on PATH")

    def dock(self, body: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError(
            "Plug the real Vina invocation into VinaDockingRunner.dock."
        )


def pick_stability_runner():
    try:
        return ThermoMPNNRunner()
    except Exception:
        return StubStabilityRunner()


def pick_docking_runner():
    try:
        return VinaDockingRunner()
    except Exception:
        return StubDockingRunner()


STABILITY_RUNNER = pick_stability_runner()
DOCKING_RUNNER = pick_docking_runner()


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
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
            self._send_json(200, {
                "status": "ok",
                "runner": STABILITY_RUNNER.name,
                "version": STABILITY_RUNNER.version,
                "dockingRunner": DOCKING_RUNNER.name,
                "dockingVersion": DOCKING_RUNNER.version,
            })
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path not in ("/predict_stability", "/dock"):
            self._send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            body = json.loads(raw)

            if self.path == "/predict_stability":
                result = STABILITY_RUNNER.predict(body["pdbId"], body["variant"])
            else:
                result = DOCKING_RUNNER.dock(body)

            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[sidecar] {fmt % args}")


def main() -> None:
    host = "127.0.0.1"
    port = 8765
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"GENESIS engine sidecar listening on http://{host}:{port}")
    print(f"Stability runner: {STABILITY_RUNNER.name} v{STABILITY_RUNNER.version}")
    print(f"Docking runner: {DOCKING_RUNNER.name} v{DOCKING_RUNNER.version}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
