#!/usr/bin/env bash
#
# Prime the local PDB cache for GENESIS Studio.
#
# Usage:
#   bash scripts/fetch-pdb.sh          # fetches 4HJO (demo default)
#   bash scripts/fetch-pdb.sh 1M17     # fetches a different PDB ID
#
# Once cached, the app prefers the local file and works offline.
# The cache lives in apps/desktop/public/, which is gitignored.

set -euo pipefail

PDB_ID="${1:-4HJO}"
OUT_DIR="apps/desktop/public"
OUT_FILE="${OUT_DIR}/${PDB_ID}.pdb"
URL="https://files.rcsb.org/download/${PDB_ID}.pdb"

mkdir -p "$OUT_DIR"

if [ -f "$OUT_FILE" ]; then
  echo "Already cached: $OUT_FILE"
  exit 0
fi

echo "Fetching ${URL}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$OUT_FILE"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$URL" -O "$OUT_FILE"
else
  echo "Error: curl or wget required" >&2
  exit 1
fi

BYTES=$(wc -c < "$OUT_FILE" | tr -d ' ')
echo "Saved ${OUT_FILE} (${BYTES} bytes)"
echo "The app will now load this file offline."
