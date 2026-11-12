@echo off
rem Opens SumTalk as a desktop app (its own window, no browser) from this source folder.
rem Uses the same Python environment, data (backend\data) and settings (backend\.env) as start.bat.
rem Run setup.bat once first. To make an installer for other PCs: build-desktop.bat
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
if not exist desktop\node_modules\electron\dist\electron.exe (
  echo Installing the desktop shell [Electron]...
  pushd desktop
  call npm install --no-fund --no-audit || (popd & exit /b 1)
  popd
)

rem Some tools (VS Code...) set this; it would make Electron run as plain Node.js without a window.
set ELECTRON_RUN_AS_NODE=
start "" desktop\node_modules\electron\dist\electron.exe desktop
