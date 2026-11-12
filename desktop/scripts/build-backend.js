// Freezes the Python backend with PyInstaller -> desktop/.pybuild/dist/sumtalk-server/
//   node scripts/build-backend.js          CPU only (~270 MB)
//   node scripts/build-backend.js --gpu    + NVIDIA cuBLAS/cuDNN from the venv (~2.3 GB)
// Also writes .pybuild/sumtalk.env.example, the settings an installed app starts with: backend/.env.example
// with every SUMTALK_DEFAULT_<NAME>=<value> environment variable applied, e.g. to ship the installer
// pre-configured for the team's speech server (no model download on customers' PCs):
//   set SUMTALK_DEFAULT_STT_PROVIDER=remote
//   set SUMTALK_DEFAULT_STT_BASE_URL=https://sumtalk.example.com/v1
//   set SUMTALK_DEFAULT_STT_API_KEY=<a key from the server's STT_SERVER_API_KEYS>
// (anyone with the installer can read these values: use a key you can revoke)
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

/** backend/.env.example with the SUMTALK_DEFAULT_* overrides applied. */
function installerSettings(env = process.env) {
  let settings = fs.readFileSync(path.join(repo, 'backend', '.env.example'), 'utf8').replace(/\r\n/g, '\n')
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('SUMTALK_DEFAULT_')) continue
    const name = key.slice('SUMTALK_DEFAULT_'.length)
    const line = new RegExp(`^${name}=.*$`, 'm')
    settings = line.test(settings) ? settings.replace(line, () => `${name}=${value}`) : `${settings.trimEnd()}\n${name}=${value}\n`
    console.log(`Installer default: ${name}=${/KEY|SECRET/.test(name) ? '***' : value}`)
  }
  return settings
}

function writeInstallerSettings() {
  fs.mkdirSync(path.join(desktop, '.pybuild'), { recursive: true })
  fs.writeFileSync(path.join(desktop, '.pybuild', 'sumtalk.env.example'), installerSettings())
}

function run(args, env = process.env) {
  const result = spawnSync(python, args, { cwd: repo, stdio: 'inherit', env })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (require.main === module) {
  if (process.argv.includes('--settings-only')) {
    writeInstallerSettings()
    process.exit(0)
  }
  if (!fs.existsSync(python)) {
    console.error(`Python environment not found: ${python}\nRun setup.bat first.`)
    process.exit(1)
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
  writeInstallerSettings()
}

module.exports = { installerSettings }
