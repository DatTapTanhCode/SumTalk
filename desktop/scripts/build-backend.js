// Freezes the Python backend with PyInstaller -> desktop/.pybuild/dist/sumtalk-server/
//   node scripts/build-backend.js          CPU only (~270 MB)
//   node scripts/build-backend.js --gpu    + NVIDIA cuBLAS/cuDNN from the venv (~2.3 GB)
'use strict'

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const desktop = path.resolve(__dirname, '..')
const repo = path.resolve(desktop, '..')
const isWin = process.platform === 'win32'
const python =
  process.env.SUMTALK_PYTHON ||
  path.join(repo, 'backend', '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')
const gpu = process.argv.includes('--gpu')

if (!fs.existsSync(python)) {
  console.error(`Python environment not found: ${python}\nRun setup.bat first.`)
  process.exit(1)
}

function run(args, env = process.env) {
  const result = spawnSync(python, args, { cwd: repo, stdio: 'inherit', env })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(['-m', 'pip', 'install', '-q', '-r', path.join('backend', 'requirements-desktop.txt')])
console.log(`Building the backend (${gpu ? 'GPU + CPU' : 'CPU only'})...`)
run(
  [
    '-m', 'PyInstaller', path.join('desktop', 'sumtalk-server.spec'),
    '--noconfirm',
    '--distpath', path.join('desktop', '.pybuild', 'dist'),
    '--workpath', path.join('desktop', '.pybuild', 'work'),
  ],
  { ...process.env, SUMTALK_GPU: gpu ? '1' : '0' },
)
