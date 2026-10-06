"""
GENESIS Studio engine sidecar.

Stdlib-only HTTP service. Optionally wraps real scientific engines if
their dependencies are installed. Falls back to deterministic stubs
otherwise. The name of the active runner is reported in /health so the
UI can tell the truth about what is running.

Run:
    python server.py

Optional real engines (install in a Python 3.11/3.12 venv):
    - ThermoMPNN (PyTorch) for real ddG predictions
    - AutoDock Vina (native binary) for real docking
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import subprocess
import tempfile
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional


# ============================================================
# Stability runners
# ============================================================

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


def _load_thermompnn():
    """
    Try to import ThermoMPNN. Returns (predict_callable, describe_str).
    Supports several API shapes across ThermoMPNN versions.
    """
    try:
        import torch  # noqa: F401
    except Exception:
        return None, "torch not installed"

    # Modern inference module
    try:
        from thermompnn.inference import predict as _p  # type: ignore
        return _p, "thermompnn.inference.predict"
    except Exception:
        pass

    # Pipeline class
    try:
        from thermompnn.pipeline import ThermoMPNNPredictor  # type: ignore
        weight = os.environ.get("THERMOMPNN_WEIGHTS", "thermoMPNN_weights.pt")
        inst = ThermoMPNNPredictor(weight_path=weight)
        return inst.predict, "thermompnn.pipeline.ThermoMPNNPredictor"
    except Exception:
        pass

    # Direct model class
    try:
        from thermompnn.model import ThermoMPNN  # type: ignore
        return ThermoMPNN, "thermompnn.model.ThermoMPNN"
    except Exception:
        pass

    return None, "thermompnn not installed or API not recognized"


class ThermoMPNNRunner:
    """
    Real ThermoMPNN runner.

    Requires:
        - Python 3.11 or 3.12 (PyTorch does not support 3.14)
        - pip install torch thermompnn
        - thermoMPNN_weights.pt next to this file (or THERMOMPNN_WEIGHTS env)

    The exact call signature of ThermoMPNN varies between releases. This
    class detects what is available and adapts. If the signature differs
    from any of the known forms, set the appropriate form below.
    """

    name = "ThermoMPNNRunner"
    version = "1.0.0"

    def __init__(self) -> None:
        self.predict_fn, self.api_shape = _load_thermompnn()
        if self.predict_fn is None:
            raise ImportError(f"ThermoMPNN not available: {self.api_shape}")

    def predict(self, pdb_id: str, variant: Dict[str, Any]) -> Dict[str, Any]:
        pdb_path = _ensure_pdb_cached(pdb_id)
        hgvs = variant.get("hgvs", "")
        if not hgvs:
            raise ValueError("variant.hgvs required")

        # Try the most common signatures.
        # 1. predict(pdb_path, mutations=[hgvs])
        try:
            result = self.predict_fn(pdb_path, mutations=[hgvs])
            return _normalize_thermompnn(result)
        except TypeError:
            pass

        # 2. predict(pdb_path, hgvs)
        try:
            result = self.predict_fn(pdb_path, hgvs)
            return _normalize_thermompnn(result)
        except TypeError:
            pass

        # 3. predict(pdb_path, mutation_string=hgvs)
        try:
            result = self.predict_fn(pdb_path, mutation_string=hgvs)
            return _normalize_thermompnn(result)
        except TypeError:
            pass

        raise RuntimeError(
            "ThermoMPNN predict signature not recognized. "
            f"Detected API: {self.api_shape}. "
            "Fill in ThermoMPNNRunner.predict for your version."
        )


def _normalize_thermompnn(result: Any) -> Dict[str, Any]:
    """Best-effort extraction of ddG from whatever ThermoMPNN returned."""
    ddg: Optional[float] = None
    if isinstance(result, dict):
        for key in ("ddG", "ddg", "delta_ddG", "ddG_pred"):
            if key in result:
                try:
                    ddg = float(result[key])
                    break
                except Exception:
                    pass
    elif isinstance(result, (int, float)):
        ddg = float(result)
    elif hasattr(result, "item"):
        try:
            ddg = float(result.item())
        except Exception:
            pass

    if ddg is None:
        raise RuntimeError(f"Could not extract ddG from ThermoMPNN output: {result!r}")

    band = max(0.3, abs(ddg) * 0.2)
    return {
        "deltaDeltaG": round(ddg, 2),
        "deltaDeltaGCI": [round(ddg - band, 2), round(ddg + band, 2)],
        "method": "ThermoMPNN",
        "methodVersion": "1.0.0",
        "notes": "Real ThermoMPNN prediction.",
    }


# ============================================================
# Docking runners
# ============================================================

class StubDockingRunner:
    name = "StubDocking"
    version = "0.0.1"

    def dock(self, body: Dict[str, Any]) -> Dict[str, Any]:
        p = body["protein"]  # {x,y,z}
        l = body["ligandPoint"]  # {x,y,z}
        dx = l["x"] - p["x"]; dy = l["y"] - p["y"]; dz = l["z"] - p["z"]
        distance = math.sqrt(dx * dx + dy * dy + dz * dz)
        optimal = 3.5
        sigma = 1.5
        score = math.exp(-((distance - optimal) ** 2) / (2 * sigma * sigma))
        kd_nm = 10.0 * math.pow(10000.0, 1.0 - score)
        return {
            "distanceAngstrom": round(distance, 2),
            "estimatedKdNm": round(kd_nm, 2),
            "bindingEnergyKcal": None,
            "method": "Sidecar geometric stub",
            "methodVersion": self.version,
            "notes": "Geometric estimate. Not a real docking score.",
        }


class VinaDockingRunner:
    """
    Real AutoDock Vina docking.

    Requires on PATH:
        - vina       (AutoDock Vina binary)
        - obabel     (Open Babel for PDBQT conversion)

    Install on Windows: download from https://vina.scripps.edu/downloads/
    Install on Linux/mac: conda install -c conda-forge vina openbabel

    Score interpretation:
        Vina reports binding energy in kcal/mol.
        Kd is estimated from the standard relationship:
            dG = R * T * ln(Kd)  ->  Kd = exp(dG / (R * T))
        At T = 298.15 K, R = 0.001987 kcal / (mol K).
    """

    name = "VinaDocking"
    version = "1.0.0"

    def __init__(self) -> None:
        self.vina = shutil.which("vina")
        self.obabel = shutil.which("obabel")
        if not self.vina:
            raise ImportError("vina binary not found on PATH")
        if not self.obabel:
            raise ImportError("obabel binary not found on PATH")

    def dock(self, body: Dict[str, Any]) -> Dict[str, Any]:
        pdb_id = body["pdbId"]
        smiles = body.get("ligandSmiles", "")
        if not smiles:
            raise ValueError("ligandSmiles required for Vina docking")

        center = body.get("center", {"x": 0, "y": 0, "z": 0})
        box_size = float(body.get("boxSize", 22.0))

        with tempfile.TemporaryDirectory(prefix="genesis_dock_") as tmp:
            tmp_path = Path(tmp)
            receptor_pdb = tmp_path / "receptor.pdb"
            receptor_pdbqt = tmp_path / "receptor.pdbqt"
            ligand_pdb = tmp_path / "ligand.pdb"
            ligand_pdbqt = tmp_path / "ligand.pdbqt"
            vina_out = tmp_path / "vina_out.pdbqt"
            vina_log = tmp_path / "vina_log.txt"

            # 1. Receptor
            pdb_text = _download_pdb_text(pdb_id)
            receptor_pdb.write_text(pdb_text)

            # Convert receptor: strip waters, add hydrogens not needed for Vina
            subprocess.run(
                [self.obabel, str(receptor_pdb), "-O", str(receptor_pdbqt), "-xr"],
                capture_output=True, check=True, timeout=60,
            )

            # 2. Ligand from SMILES, generate 3D coordinates
            subprocess.run(
                [self.obabel, f"-:{smiles}", "-O", str(ligand_pdb), "--gen3d"],
                capture_output=True, check=True, timeout=60,
            )
            subprocess.run(
                [self.obabel, str(ligand_pdb), "-O", str(ligand_pdbqt)],
                capture_output=True, check=True, timeout=60,
            )

            # 3. Run Vina
            cmd = [
                self.vina,
                "--receptor", str(receptor_pdbqt),
                "--ligand", str(ligand_pdbqt),
                "--center_x", str(center["x"]),
                "--center_y", str(center["y"]),
                "--center_z", str(center["z"]),
                "--size_x", str(box_size),
                "--size_y", str(box_size),
                "--size_z", str(box_size),
                "--out", str(vina_out),
                "--log", str(vina_log),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                raise RuntimeError(f"Vina failed: {result.stderr}")

            # 4. Parse the log for the top score
            energy = _parse_vina_energy(vina_log.read_text())
            if energy is None:
                raise RuntimeError("Could not parse Vina output")

            kd_nm = _energy_to_kd_nm(energy)
            return {
                "distanceAngstrom": None,
                "estimatedKdNm": round(kd_nm, 4),
                "bindingEnergyKcal": round(energy, 2),
                "method": "AutoDock Vina",
                "methodVersion": self.version,
                "notes": f"Real docking. dG = {energy:.2f} kcal/mol.",
            }


def _parse_vina_energy(log: str) -> Optional[float]:
    for line in log.splitlines():
        line = line.strip()
        if line.startswith("1 "):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    return float(parts[1])
                except ValueError:
                    continue
    return None


def _energy_to_kd_nm(energy_kcal: float) -> float:
    R = 0.001987  # kcal / (mol K)
    T = 298.15    # K
    # dG = R T ln(Kd)  in M units, so Kd_M = exp(dG / (R T))
    kd_m = math.exp(energy_kcal / (R * T))
    return kd_m * 1e9  # to nM


# ============================================================
# PDB cache
# ============================================================

CACHE_DIR = Path(__file__).parent / ".pdb_cache"
CACHE_DIR.mkdir(exist_ok=True)


def _ensure_pdb_cached(pdb_id: str) -> str:
    p = CACHE_DIR / f"{pdb_id}.pdb"
    if not p.exists():
        p.write_text(_download_pdb_text(pdb_id))
    return str(p)


def _download_pdb_text(pdb_id: str) -> str:
    cached = CACHE_DIR / f"{pdb_id}.pdb"
    if cached.exists():
        return cached.read_text()
    url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
    with urllib.request.urlopen(url, timeout=30) as r:
        text = r.read().decode("utf-8")
    cached.write_text(text)
    return text


# ============================================================
# Runner selection
# ============================================================

def _pick_stability():
    try:
        r = ThermoMPNNRunner()
        return r
    except Exception as e:
        print(f"[sidecar] ThermoMPNN unavailable: {e}")
        return StubStabilityRunner()


def _pick_docking():
    try:
        r = VinaDockingRunner()
        return r
    except Exception as e:
        print(f"[sidecar] Vina unavailable: {e}")
        return StubDockingRunner()


STABILITY_RUNNER = _pick_stability()
DOCKING_RUNNER = _pick_docking()


# ============================================================
# HTTP handler
# ============================================================

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
