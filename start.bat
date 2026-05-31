@echo off
REM ============================================================
REM  HillingOne — start all dev servers
REM  Run this from the project root:  start.bat
REM ============================================================

echo.
echo  HillingOne — starting dev servers
echo  ==================================
echo.

REM ── 1. Kill anything already on 8000 ───────────────────────
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000 " ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM ── 2. Start atrium backend (port 8000) ────────────────────
echo  [1/2] Starting atrium backend on http://localhost:8000 ...
start "Atrium Backend" /D "%~dp0atrium\backend" ^
    "%~dp0venv\Scripts\python.exe" ^
    -m uvicorn app.main:app --port 8000 --reload

REM Give the backend a moment to bind the port
timeout /t 4 /nobreak >nul

REM ── 3. Start React frontend (port 5173) ────────────────────
echo  [2/2] Starting React frontend on http://localhost:5173 ...
start "React Frontend" /D "%~dp0atrium\frontend" ^
    cmd /k "npm run dev"

echo.
echo  Both servers are starting in their own windows.
echo.
echo  Frontend  →  http://localhost:5173
echo  API docs  →  http://localhost:8000/docs
echo  Health    →  http://localhost:8000/health
echo.
echo  Press any key to exit this window (servers keep running).
pause >nul
