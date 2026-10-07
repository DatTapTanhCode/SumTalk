@echo off
rem Development mode: backend with auto-reload (port 8000) + Vite dev server with hot reload (port 5173).
setlocal
cd /d "%~dp0"

start "SumTalk API" cmd /k backend\.venv\Scripts\python.exe backend\run.py --reload
cd frontend
call npm run dev
