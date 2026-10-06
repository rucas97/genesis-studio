#!/usr/bin/env bash
#
# One-shot setup for ThermoMPNN + AutoDock Vina in GENESIS Studio.
#
# What this does:
#   1. Installs uv (fast Python installer, no admin needed)
#   2. Creates a Python 3.12 venv
#   3. Installs PyTorch (CPU) and ThermoMPNN dependencies
#   4. Clones the ThermoMPNN repo
#   5. Downloads thermoMPNN_default.pt (the pretrained weights)
#   6. Adds ThermoMPNN to the venv's PYTHONPATH
#   7. Runs a smoke test
#
# Usage:
#   bash scripts/setup-thermompnn.sh

set -euo pipefail

cd "$(dirname "$0")/../packages/engines-py"

WEIGHTS_URL="https://github.com/Kuhlman-Lab/ThermoMPNN/raw/main/models/thermoMPNN_default.pt"
WEIGHTS_ALT="https://media.githubusercontent.com/media/Kuhlman-Lab/ThermoMPNN/main/models/thermoMPNN_default.pt"
THERMOMPNN_DIR=".thermompnn"
WEIGHTS_PATH="$THERMOMPNN_DIR/models/thermoMPNN_default.pt"

# ---------- 1. uv ----------
if ! command -v uv >/dev/null 2>&1; then
  echo "[1/7] Installing uv..."
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OS" == "Windows_NT" ]]; then
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  else
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
else
  echo "[1/7] uv already installed."
fi

# ---------- 2. venv ----------
echo "[2/7] Creating Python 3.12 venv in .venv/"
uv venv --python 3.12 --clear .venv

if [[ -f ".venv/Scripts/activate" ]]; then
  source .venv/Scripts/activate
else
  source .venv/bin/activate
fi

# ---------- 3. torch (CPU) ----------
echo "[3/7] Installing PyTorch (CPU)..."
uv pip install torch --index-url https://download.pytorch.org/whl/cpu

# ---------- 4. clone ThermoMPNN ----------
if [ ! -d "$THERMOMPNN_DIR" ]; then
  echo "[4/7] Cloning ThermoMPNN..."
  git clone --depth 1 https://github.com/Kuhlman-Lab/ThermoMPNN.git "$THERMOMPNN_DIR"
else
  echo "[4/7] ThermoMPNN already cloned, updating..."
  git -C "$THERMOMPNN_DIR" pull --ff-only || true
fi

# ---------- 5. dependencies ----------
echo "[5/7] Installing ThermoMPNN dependencies..."
uv pip install \
  pytorch-lightning \
  omegaconf \
  wandb \
  biopython \
  joblib \
  pandas \
  numpy \
  tqdm \
  mmseqs2 2>/dev/null || \
uv pip install \
  pytorch-lightning \
  omegaconf \
  wandb \
  biopython \
  joblib \
  pandas \
  numpy \
  tqdm

# ---------- 6. weights ----------
if [ -f "$WEIGHTS_PATH" ] && [ -s "$WEIGHTS_PATH" ]; then
  echo "[6/7] Weights already present."
else
  echo "[6/7] Downloading thermoMPNN_default.pt ..."
  mkdir -p "$THERMOMPNN_DIR/models"
  # Try the standard raw URL first.
  if ! curl -fL --retry 3 --connect-timeout 15 -o "$WEIGHTS_PATH" "$WEIGHTS_URL"; then
    echo "    First URL failed, trying LFS media URL..."
    curl -fL --retry 3 --connect-timeout 15 -o "$WEIGHTS_PATH" "$WEIGHTS_ALT"
  fi
  # Sanity check: the file should be tens of MB, not an HTML error page.
  SIZE=$(wc -c < "$WEIGHTS_PATH" 2>/dev/null || echo 0)
  if [ "$SIZE" -lt 1000000 ]; then
    echo "    ERROR: downloaded file is only $SIZE bytes. Likely an error page."
    echo "    Delete $WEIGHTS_PATH and try manually:"
    echo "      open $WEIGHTS_URL in a browser"
    exit 1
  fi
  echo "    Downloaded ($((SIZE / 1024 / 1024)) MB)."
fi

# ---------- 7. PYTHONPATH + smoke test ----------
echo "[7/7] Adding ThermoMPNN to PYTHONPATH and testing..."
SITE_PACKAGES=$(python -c "import site; print(site.getsitepackages()[0])")
echo "$(pwd)/$THERMOMPNN_DIR" > "$SITE_PACKAGES/thermompnn.pth"

python - <<'PYTEST'
import importlib, sys
ok = True
try:
    import torch
    print(f"  torch        : {torch.__version__}")
except Exception as e:
    print(f"  torch        : FAIL ({e})"); ok = False
try:
    import thermompnn
    print(f"  thermompnn   : OK ({thermompnn.__file__})")
except Exception as e:
    print(f"  thermompnn   : FAIL ({e})"); ok = False
try:
    import pytorch_lightning
    print(f"  pytorch_lightning: {pytorch_lightning.__version__}")
except Exception as e:
    print(f"  pytorch_lightning: FAIL ({e})"); ok = False

import os
w = os.path.join(os.path.dirname(os.path.abspath(".")), ".thermompnn", "models", "thermoMPNN_default.pt")
w = os.path.abspath(".thermompnn/models/thermoMPNN_default.pt")
if os.path.exists(w):
    print(f"  weights      : {w} ({os.path.getsize(w)//1024//1024} MB)")
else:
    print(f"  weights      : NOT FOUND at {w}"); ok = False

sys.exit(0 if ok else 1)
PYTEST

echo ""
echo "======================================================"
echo "  Setup complete."
echo "======================================================"
echo ""
echo "Start the sidecar with the new Python:"
echo ""
if [[ -f ".venv/Scripts/activate" ]]; then
  echo "  source .venv/Scripts/activate && python server.py"
else
  echo "  source .venv/bin/activate && python server.py"
fi
echo ""
echo "The /health endpoint should report ThermoMPNNRunner."
