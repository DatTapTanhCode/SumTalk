@echo off
rem Starts SumTalk on http://localhost:8000
rem   start.bat --lan --https   ->  also reachable from a phone on the same Wi-Fi (https://<this-PC-IP>:8443)
setlocal
cd /d "%~dp0"

if not exist backend\.venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)
if not exist frontend\dist\index.html (
  echo The web app is not built yet - run setup.bat first.
  exit /b 1
)

rem Open the browser a few seconds after the server starts.
if "%~1"=="" start "" /b cmd /c "ping -n 5 127.0.0.1 >nul & start http://localhost:8000"
backend\.venv\Scripts\python.exe backend\run.py %*
