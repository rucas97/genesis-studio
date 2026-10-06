#!/usr/bin/env bash
#
# Set up a Python 3.12 environment for ThermoMPNN and AutoDock Vina.
#
# Uses `uv` because it installs any Python version without admin rights
# and is fast. If uv is not installed, this script installs it.
#
# Usage:
#   bash scripts/setup-thermompnn.sh

set -euo pipefail

cd "$(dirname "$0")/../packages/engines-py"

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv…"
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OS" == "Windows_NT" ]]; then
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  else
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi

echo "Creating Python 3.12 virtual environment in .venv/"
uv venv --python 3.12 .venv

echo ""
echo "Activating and installing torch + thermompnn…"
echo ""

if [[ -f ".venv/Scripts/activate" ]]; then
  # Windows
  source .venv/Scripts/activate
else
  # Unix
  source .venv/bin/activate
fi

uv pip install torch thermompnn

echo ""
echo "======================================================"
echo "  Setup complete."
echo "======================================================"
echo ""
echo "Download ThermoMPNN weights from:"
echo "  https://github.com/Kuhlman-Lab/ThermoMPNN/releases"
echo "Place thermoMPNN_weights.pt next to packages/engines-py/server.py"
echo ""
echo "Then run the sidecar with the new Python:"
echo ""
if [[ -f ".venv/Scripts/activate" ]]; then
  echo "  source .venv/Scripts/activate && python server.py"
else
  echo "  source .venv/bin/activate && python server.py"
fi
echo ""
echo "For real AutoDock Vina docking, install vina and obabel:"
echo "  Linux/mac:  conda install -c conda-forge vina openbabel"
echo "  Windows:    https://vina.scripps.edu/downloads/ + https://openbabel.org/"
