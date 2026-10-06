"""GENESIS Studio engine sidecar — ThermoMPNN + Vina, stdlib HTTP."""

from __future__ import annotations
import csv, hashlib, json, math, os, shutil, subprocess, sys, tempfile
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

HERE = Path(__file__).parent.resolve()
CACHE_DIR = HERE / ".pdb_cache"
CACHE_DIR.mkdir(exist_ok=True)
DDG_CACHE_DIR = HERE / ".ddg_cache"
DDG_CACHE_DIR.mkdir(exist_ok=True)

ALPHABET = "ACDEFGHIKLMNPQRSTVWY"


def parse_hgvs(hgvs):
    s = hgvs.strip()
    if s.startswith("p."):
        s = s[2:]
    if len(s) < 3:
        return None
    wt = s[0].upper(); mut = s[-1].upper()
    try:
        pos = int(s[1:-1])
    except ValueError:
        return None
    if wt not in ALPHABET or mut not in ALPHABET:
        return None
    return wt, pos, mut


class StubStabilityRunner:
    name = "StubRunner"; version = "0.0.1"
    def predict(self, pdb_id, variant):
        key = f"{pdb_id}|{variant.get('hgvs', '')}".encode()
        h = int(hashlib.sha256(key).hexdigest()[:8], 16)
        t = (h % 10000) / 10000.0
        ddg = -4.0 + t * 4.5
        band = 0.25 + ((h >> 8) % 1000) / 1000.0 * 0.55
        return {"deltaDeltaG": round(ddg, 2),
                "deltaDeltaGCI": [round(ddg - band, 2), round(ddg + band, 2)],
                "method": "Stub (sidecar)", "methodVersion": self.version,
                "notes": "Stub runner. Not for scientific use."}


class StubDockingRunner:
    name = "StubDocking"; version = "0.0.1"
    def dock(self, body):
        p = body["protein"]; l = body["ligandPoint"]
        dx = l["x"] - p["x"]; dy = l["y"] - p["y"]; dz = l["z"] - p["z"]
        distance = math.sqrt(dx*dx + dy*dy + dz*dz)
        score = math.exp(-((distance - 3.5)**2) / (2*1.5*1.5))
        kd_nm = 10.0 * math.pow(10000.0, 1.0 - score)
        return {"distanceAngstrom": round(distance, 2),
                "estimatedKdNm": round(kd_nm, 2),
                "bindingEnergyKcal": None,
                "method": "Sidecar geometric stub",
                "methodVersion": self.version,
                "notes": "Geometric estimate. Not a real docking score."}


class ThermoMPNNRunner:
    name = "ThermoMPNNRunner"; version = "1.0.0"

    def __init__(self):
        self.repo = HERE / ".thermompnn"
        self.script = self.repo / "analysis" / "custom_inference.py"
        self.weights = self.repo / "models" / "thermoMPNN_default.pt"
        if not self.script.exists():
            raise ImportError(f"custom_inference.py not found at {self.script}")
        if not self.weights.exists():
            raise ImportError(f"weights not found at {self.weights}")
        try:
            import torch  # noqa
        except ImportError as e:
            raise ImportError(f"torch not importable: {e}")

    def predict(self, pdb_id, variant):
        hgvs = variant.get("hgvs", "")
        parsed = parse_hgvs(hgvs)
        if parsed is None:
            raise ValueError(f"could not parse hgvs '{hgvs}'")
        wt, pos, mut = parsed
        csv_path = self._ensure_ddg_csv(pdb_id)
        pdb_path = CACHE_DIR / f"{pdb_id}.pdb"
        offset = self._get_chain_offset(pdb_path, "A")
        csv_pos = pos - offset
        ddg, csv_wt = self._lookup(csv_path, csv_pos, mut)
        if ddg is None:
            raise RuntimeError(
                f"no prediction for {hgvs}: tried CSV position {csv_pos} "
                f"(PDB {pos}, offset {offset}), mutation {mut} in {csv_path.name}"
            )
        notes = "Real ThermoMPNN prediction."
        if csv_wt and csv_wt != wt:
            notes = (
                f"Real ThermoMPNN prediction. Note: the structure has {csv_wt} "
                f"at position {pos} (not {wt}); this value is for p.{csv_wt}{pos}{mut}."
            )
        band = 0.30
        return {"deltaDeltaG": round(ddg, 2),
                "deltaDeltaGCI": [round(ddg - band, 2), round(ddg + band, 2)],
                "method": "ThermoMPNN", "methodVersion": "1.0.0",
                "notes": notes}

    def _get_chain_offset(self, pdb_path, chain):
        """Return the residue number of the first residue in the chain."""
        try:
            with open(pdb_path) as f:
                for line in f:
                    if line.startswith("ATOM") and len(line) > 21 and line[21] == chain:
                        return int(line[22:26].strip())
        except Exception:
            pass
        return 0

    def _ensure_ddg_csv(self, pdb_id):
        cache = DDG_CACHE_DIR / f"{pdb_id}.csv"
        if cache.exists():
            return cache
        pdb_path = _ensure_pdb_cached(pdb_id)
        out_dir = DDG_CACHE_DIR / f"{pdb_id}_raw"
        out_dir.mkdir(exist_ok=True)
        cmd = [sys.executable, "custom_inference.py",
               "--pdb", str(pdb_path), "--chain", "A",
               "--model_path", str(self.weights), "--out_dir", str(out_dir)]
        env = os.environ.copy()
        env["PYTHONPATH"] = str(self.repo) + os.pathsep + env.get("PYTHONPATH", "")
        result = subprocess.run(cmd, cwd=str(self.repo / "analysis"),
                                capture_output=True, text=True, timeout=900, env=env)
        if result.returncode != 0:
            raise RuntimeError(f"custom_inference.py failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")
        produced = sorted(out_dir.glob("*.csv"))
        if not produced:
            produced = sorted(pdb_path.parent.glob(f"{pdb_id}*.csv"))
        if not produced:
            raise RuntimeError(f"no CSV produced in {out_dir}. STDOUT tail:\n{result.stdout[-2000:]}")
        shutil.copy(produced[-1], cache)
        return cache

    def _lookup(self, csv_path, pos, mut):
        """Match by position + mutation only. Returns (ddg, csv_wildtype)."""
        with csv_path.open(newline="") as f:
            for row in csv.DictReader(f):
                try:
                    if int(row.get("position", -1)) != pos:
                        continue
                except (ValueError, TypeError):
                    continue
                if row.get("mutation", "").strip().upper() != mut:
                    continue
                val = row.get("ddG_pred")
                if val in (None, "", "None"):
                    continue
                try:
                    ddg = float(val)
                except ValueError:
                    continue
                csv_wt = row.get("wildtype", "").strip().upper()
                return ddg, csv_wt
        return None, None


class VinaDockingRunner:
    name = "VinaDocking"; version = "1.0.0"
    def __init__(self):
        self.vina = shutil.which("vina")
        self.obabel = shutil.which("obabel")
        if not self.vina:
            raise ImportError("vina binary not found on PATH")
        if not self.obabel:
            raise ImportError("obabel binary not found on PATH")
    def dock(self, body):
        pdb_id = body["pdbId"]
        smiles = body.get("ligandSmiles", "")
        if not smiles:
            raise ValueError("ligandSmiles required")
        center = body.get("center", {"x": 0, "y": 0, "z": 0})
        box_size = float(body.get("boxSize", 22.0))
        with tempfile.TemporaryDirectory(prefix="genesis_dock_") as tmp:
            tmp_path = Path(tmp)
            receptor_pdb = tmp_path / "receptor.pdb"
            receptor_pdbqt = tmp_path / "receptor.pdbqt"
            ligand_pdb = tmp_path / "ligand.pdb"
            ligand_pdbqt = tmp_path / "ligand.pdbqt"
            vina_out = tmp_path / "out.pdbqt"
            vina_log = tmp_path / "log.txt"
            receptor_pdb.write_text(_download_pdb_text(pdb_id))
            subprocess.run([self.obabel, str(receptor_pdb), "-O", str(receptor_pdbqt), "-xr"],
                           capture_output=True, check=True, timeout=60)
            subprocess.run([self.obabel, f"-:{smiles}", "-O", str(ligand_pdb), "--gen3d"],
                           capture_output=True, check=True, timeout=60)
            subprocess.run([self.obabel, str(ligand_pdb), "-O", str(ligand_pdbqt)],
                           capture_output=True, check=True, timeout=60)
            cmd = [self.vina, "--receptor", str(receptor_pdbqt), "--ligand", str(ligand_pdbqt),
                   "--center_x", str(center["x"]), "--center_y", str(center["y"]),
                   "--center_z", str(center["z"]),
                   "--size_x", str(box_size), "--size_y", str(box_size), "--size_z", str(box_size),
                   "--out", str(vina_out)]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                raise RuntimeError(f"Vina failed: {r.stderr or r.stdout}")
            # Vina 1.2.7 prints results to stdout, not a log file.
            # Note: 0.0 is a valid energy, so check for None explicitly.
            energy = _parse_vina_energy(r.stdout)
            if energy is None:
                energy = _parse_vina_energy(r.stderr)
            if energy is None:
                raise RuntimeError(
                    f"Could not parse Vina output.\n"
                    f"STDOUT:\n{r.stdout[-1000:]}\nSTDERR:\n{r.stderr[-1000:]}"
                )
            kd_nm = _energy_to_kd_nm(energy)
            return {"distanceAngstrom": None, "estimatedKdNm": round(kd_nm, 4),
                    "bindingEnergyKcal": round(energy, 2),
                    "method": "AutoDock Vina", "methodVersion": self.version,
                    "notes": f"Real docking. dG = {energy:.2f} kcal/mol."}


def _parse_vina_energy(log):
    """Vina 1.2.7 output looks like:

    mode |   affinity | dist from best mode
         | (kcal/mol) | rmsd l.b.| rmsd u.b.
    -----+------------+----------+----------
       1       -8.4          0          0
       2       -7.9      1.234      1.876
    """
    for line in log.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parts = stripped.split()
        # First column is the mode number; expect it to be "1"
        if parts and parts[0] == "1" and len(parts) >= 2:
            try:
                return float(parts[1])
            except ValueError:
                continue
    return None


def _energy_to_kd_nm(energy_kcal):
    R = 0.001987; T = 298.15
    return math.exp(energy_kcal / (R * T)) * 1e9


def _ensure_pdb_cached(pdb_id):
    p = CACHE_DIR / f"{pdb_id}.pdb"
    if not p.exists():
        p.write_text(_download_pdb_text(pdb_id))
    return p


def _download_pdb_text(pdb_id):
    url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8")


def _pick_stability():
    try:
        return ThermoMPNNRunner()
    except Exception as e:
        print(f"[sidecar] ThermoMPNN unavailable: {e}")
        return StubStabilityRunner()


def _pick_docking():
    try:
        return VinaDockingRunner()
    except Exception as e:
        print(f"[sidecar] Vina unavailable: {e}")
        return StubDockingRunner()


STABILITY_RUNNER = _pick_stability()
DOCKING_RUNNER = _pick_docking()


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {
                "status": "ok",
                "runner": STABILITY_RUNNER.name, "version": STABILITY_RUNNER.version,
                "dockingRunner": DOCKING_RUNNER.name, "dockingVersion": DOCKING_RUNNER.version,
            })
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path not in ("/predict_stability", "/dock"):
            self._send_json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if self.path == "/predict_stability":
                result = STABILITY_RUNNER.predict(body["pdbId"], body["variant"])
            else:
                result = DOCKING_RUNNER.dock(body)
            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def log_message(self, fmt, *args):
        print(f"[sidecar] {fmt % args}")


def main():
    print(f"GENESIS engine sidecar listening on http://127.0.0.1:8765")
    print(f"Stability runner: {STABILITY_RUNNER.name} v{STABILITY_RUNNER.version}")
    print(f"Docking runner:   {DOCKING_RUNNER.name} v{DOCKING_RUNNER.version}")
    print("Press Ctrl+C to stop.")
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
