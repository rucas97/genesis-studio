#!/usr/bin/env bash
#
# Install AutoDock Vina and Open Babel on Windows, add them to PATH.
#
# Vina ships as a single bare .exe with no installer.
# Open Babel ships as a proper Windows installer.
#
# Usage:
#   bash scripts/setup-vina.sh

set -euo pipefail

VINA_DIR="$HOME/AppData/Local/Vina"
VINA_EXE="$VINA_DIR/vina.exe"
VINA_URL="https://github.com/ccsb-scripps/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_win.exe"

OB_DIR="$HOME/AppData/Local/OpenBabel"
OB_EXE="$OB_DIR/obabel.exe"
OB_URL="https://github.com/openbabel/openbabel/releases/download/openbabel-3-1-1/OpenBabel-3.1.1-x64.exe"

# ---------- 1. Vina ----------
echo "[1/3] Installing AutoDock Vina..."
mkdir -p "$VINA_DIR"

if [ -f "$VINA_EXE" ]; then
  echo "  Already installed: $VINA_EXE"
else
  echo "  Downloading vina_1.2.7_win.exe ..."
  curl -fL --retry 3 --connect-timeout 20 -o "$VINA_EXE" "$VINA_URL"
  echo "  Saved to $VINA_EXE"
fi

# Sanity check
if ! "$VINA_EXE" --version >/dev/null 2>&1; then
  echo "  WARNING: vina.exe did not respond to --version"
  echo "  It may need a moment to initialize on first run. Continuing."
fi

# ---------- 2. Open Babel ----------
echo "[2/3] Installing Open Babel..."
mkdir -p "$OB_DIR"

if [ -f "$OB_EXE" ]; then
  echo "  Already installed: $OB_EXE"
else
  TMP_INSTALLER="$HOME/AppData/Local/Temp/OpenBabel-3.1.1-x64.exe"
  TMP_INSTALLER_WIN=$(cygpath -w "$TMP_INSTALLER")
  OB_DIR_WIN=$(cygpath -w "$OB_DIR")
  echo "  Downloading OpenBabel-3.1.1-x64.exe ..."
  curl -fL --retry 3 --connect-timeout 20 -o "$TMP_INSTALLER" "$OB_URL"
  echo "  Running silent installer ..."
  # NSIS silent installers require /S (uppercase) and /D=path with no quotes.
  # Run through cmd.exe so Windows can execute the installer.
  cmd //c "$TMP_INSTALLER_WIN" /S /D="$OB_DIR_WIN"
  sleep 5
  rm -f "$TMP_INSTALLER"
  if [ ! -f "$OB_EXE" ]; then
    echo "  ERROR: obabel.exe not found at $OB_EXE after install."
    echo "  The installer may have placed it elsewhere. Check:"
    echo "    ls $OB_DIR"
    exit 1
  fi
  echo "  Installed to $OB_DIR"
fi

# ---------- 3. PATH ----------
echo "[3/3] Adding both folders to user PATH..."

# Use PowerShell to update the user PATH persistently.
powershell -NoProfile -Command "
  \$current = [Environment]::GetEnvironmentVariable('Path', 'User')
  \$add = @('$VINA_DIR', '$OB_DIR') -join ';'
  if (\$current -notlike '*Vina*') {
    [Environment]::SetEnvironmentVariable('Path', \$current + ';' + \$add, 'User')
    Write-Host '  PATH updated. Restart your terminal for it to take effect.'
  } else {
    Write-Host '  PATH already contains Vina or OpenBabel.'
  }
"

# Also export for the current shell so we can test now.
export PATH="$VINA_DIR:$OB_DIR:$PATH"

echo ""
echo "======================================================"
echo "  Verification"
echo "======================================================"
echo ""

if "$VINA_EXE" --version 2>&1 | head -1; then
  echo "  vina:  OK"
else
  echo "  vina:  FAILED (see above)"
fi

if "$OB_EXE" -V 2>&1 | head -1; then
  echo "  obabel: OK"
else
  echo "  obabel: FAILED (see above)"
fi

echo ""
echo "Next:"
echo "  1. Close this terminal and open a new one (so PATH is reloaded)"
echo "  2. Restart the sidecar: python server.py"
echo "  3. The startup banner should read:"
echo "       Docking runner:   VinaDocking v1.0.0"
