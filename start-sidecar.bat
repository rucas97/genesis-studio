@echo off
REM Start the GENESIS engine sidecar on Windows.
cd /d "%~dp0packages\engines-py"
echo Starting GENESIS engine sidecar on http://127.0.0.1:8765
echo Press Ctrl+C to stop.
python server.py
