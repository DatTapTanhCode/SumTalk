@echo off
rem Builds the Windows desktop app for other PCs (no Python / Node.js needed there).
rem   build-desktop.bat         -> desktop\dist\SumTalk-Setup-<version>.exe   (installer, ~200 MB, CPU transcription)
rem   build-desktop.bat --gpu   -> desktop\dist\win-unpacked\                 (+ NVIDIA CUDA libraries, ~2.5 GB:
rem                                too big for an installer - zip the folder, run SumTalk.exe inside it)
rem Run setup.bat once first. Needs an internet connection the first time (Electron, PyInstaller, NSIS).
setlocal
cd /d "%~dp0"

if not exist backend\.venv\Scripts\python.exe (
  echo Run setup.bat first.
  exit /b 1
)

pushd desktop
call npm install --no-fund --no-audit || goto :error

if /i "%~1"=="--gpu" goto :gpu
call npm run dist || goto :error
popd
echo.
echo Done: desktop\dist\SumTalk-Setup-*.exe
exit /b 0

:gpu
call npm run dist:gpu || goto :error
popd
echo.
echo Done: desktop\dist\win-unpacked\SumTalk.exe - copy or zip the whole win-unpacked folder.
exit /b 0

:error
popd
echo.
echo Build failed - see the messages above.
exit /b 1
