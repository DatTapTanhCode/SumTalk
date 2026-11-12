# PyInstaller recipe for the desktop app's backend -> desktop/.pybuild/dist/sumtalk-server/sumtalk-server.exe
#
#   backend\.venv\Scripts\python -m PyInstaller desktop\sumtalk-server.spec --noconfirm ^
#       --distpath desktop\.pybuild\dist --workpath desktop\.pybuild\work
#
# Normally run through `npm run build:backend` in desktop/ (or build-desktop.bat).
# SUMTALK_GPU=1 also copies the NVIDIA cuBLAS/cuDNN DLLs from the venv (~2 GB, see build-desktop.bat --gpu).
# Without them the packaged app transcribes on the CPU.

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = Path(SPECPATH).resolve().parent  # noqa: F821 - defined by PyInstaller
BACKEND = ROOT / "backend"

datas, binaries, hiddenimports = [], [], []

# Native libraries and data files that static analysis misses:
#   faster_whisper - Silero VAD model (assets/*.onnx)      ctranslate2 - Whisper inference DLLs
#   av             - FFmpeg DLLs (decoding of every upload) onnxruntime - runs the VAD model
#   tokenizers     - Whisper tokenizer (Rust extension)
for package in ("faster_whisper", "ctranslate2", "av", "onnxruntime", "tokenizers"):
    d, b, h = collect_all(package)
    datas += d
    binaries += b
    hiddenimports += h

# uvicorn picks its event loop / HTTP / websocket implementations by name at runtime.
hiddenimports += collect_submodules("uvicorn")
hiddenimports += collect_submodules("app")

if os.environ.get("SUMTALK_GPU") == "1":
    import nvidia  # namespace package of the nvidia-cublas-cu12 / nvidia-cudnn-cu12 wheels

    count = 0
    for base in map(Path, nvidia.__path__):
        for dll in base.glob("*/bin/*.dll"):
            # Same layout as site-packages, so transcriber._register_nvidia_libraries() finds them.
            binaries.append((str(dll), f"nvidia/{dll.parent.parent.name}/bin"))
            count += 1
    if not count:
        raise SystemExit("SUMTALK_GPU=1 but no NVIDIA DLLs found - pip install -r backend/requirements-gpu.txt")
    print(f"Bundling {count} NVIDIA DLLs for GPU transcription")

a = Analysis(  # noqa: F821
    [str(BACKEND / "run.py")],
    pathex=[str(BACKEND)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "matplotlib", "IPython", "pytest", "ruff", "srt", "PyInstaller"],
    noarchive=False,
)
pyz = PYZ(a.pure)  # noqa: F821

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="sumtalk-server",
    console=True,  # the desktop app starts it hidden and reads its output through a pipe
    upx=False,
)

coll = COLLECT(  # noqa: F821
    exe,
    a.binaries,
    a.datas,
    name="sumtalk-server",
    upx=False,
)
