@echo off
rem Double-click to open the workboard. Keep this window open while you use it; close it to stop.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed to run the workboard and was not found.
  pause
  exit /b 1
)
start "" http://localhost:5190
node workboard\server.mjs
if errorlevel 1 pause
