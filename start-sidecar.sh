#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/packages/engines-py"
echo "Starting GENESIS engine sidecar on http://127.0.0.1:8765"
echo "Press Ctrl+C to stop."
exec python server.py
