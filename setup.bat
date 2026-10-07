@echo off
rem One-time setup on Windows: Python env + packages, web app packages, web app build.
setlocal
cd /d "%~dp0"

where python >nul 2>&1 || (echo Python 3.10+ is required: https://www.python.org/downloads/ & exit /b 1)
where npm >nul 2>&1 || (echo Node.js 20+ is required: https://nodejs.org/ & exit /b 1)

echo [1/4] Creating the Python virtual environment...
if not exist backend\.venv\Scripts\python.exe (
  python -m venv backend\.venv || goto :error
)

echo [2/4] Installing backend packages (FastAPI, faster-whisper)...
backend\.venv\Scripts\python.exe -m pip install --upgrade pip -q
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt || goto :error

nvidia-smi >nul 2>&1 && (
  echo       NVIDIA GPU found - installing CUDA libraries for fast transcription...
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-gpu.txt
)

echo [3/4] Installing web app packages...
pushd frontend
call npm install --no-fund --no-audit || (popd & goto :error)

echo [4/4] Building the web app...
call npm run build || (popd & goto :error)
popd

echo.
echo Setup complete. Run start.bat, then open http://localhost:8000
echo (the first start downloads the Whisper model: ~1.6 GB with a GPU, ~0.5 GB on CPU)
exit /b 0

:error
echo.
echo Setup failed - see the messages above.
exit /b 1
