#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Starting GENESIS desktop app (Vite)."
echo "Sidecar runs separately: ./start-sidecar.sh"
echo ""
exec npm run dev -w @genesis/desktop
