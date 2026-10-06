#!/usr/bin/env bash
#
# Prime the sidecar's ddG cache for the proteins used by the demo.
#
# The first prediction for any PDB runs site-saturation mutagenesis on
# the whole chain (1-3 minutes). This script runs one mutation per PDB
# up front so the app never stalls.
#
# Usage:
#   bash scripts/prime-cache.sh

set -euo pipefail

BASE="http://127.0.0.1:8765"

predict() {
  local pdb="$1"
  local hgvs="$2"
  echo "  $pdb $hgvs"
  curl -s -X POST "$BASE/predict_stability" \
    -H "Content-Type: application/json" \
    -d "{\"pdbId\":\"$pdb\",\"variant\":{\"hgvs\":\"$hgvs\"}}" \
    | python -c "import json,sys; d=json.load(sys.stdin); print('    ->', d.get('deltaDeltaG', d.get('error','?')))" 2>/dev/null \
    || echo "    -> failed"
}

echo "Priming ThermoMPNN cache for the standard demo proteins"
echo "(first prediction per PDB takes 1-3 minutes)"
echo ""

# Health check first
curl -s "$BASE/health" || { echo "sidecar not running on $BASE"; exit 1; }
echo ""
echo ""

predict "2ITN" "p.L858R"   # EGFR
predict "4OBE" "p.G12C"    # KRAS
predict "2HYY" "p.T315I"   # ABL
predict "4JPS" "p.H1047R"  # PIK3CA
predict "4BBE" "p.V617F"   # JAK2
predict "1HXB" "p.D25N"    # HIV protease
predict "6LU7" "p.C145A"   # SARS-CoV-2 Mpro

echo ""
echo "Cache primed. The app will now predict these instantly."
echo ""
echo "To check what is cached:"
echo "  ls packages/engines-py/.ddg_cache/*.csv"
