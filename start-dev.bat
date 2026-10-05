@echo off
REM Start the GENESIS desktop app on Windows.
cd /d "%~dp0"
echo Starting GENESIS desktop app (Vite).
echo Sidecar runs separately: start-sidecar.bat
echo.
npm run dev -w @genesis/desktop
