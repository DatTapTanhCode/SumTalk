// End-to-end check of the desktop app with Playwright (from frontend/node_modules).
//   npm test                 the app from source (backend/.venv) - uses a temporary data folder
//   npm test -- --packaged   desktop/dist/win-unpacked/SumTalk.exe (after build-desktop.bat);
//                            uses the installed app's data folder %LOCALAPPDATA%\SumTalk
// Checks: the window loads the app from the local backend, the page has no Node.js access, the
// microphone and the system-audio capture work without a prompt, and closing the window stops
// the backend. The speech model is not loaded (PRELOAD_MODEL=false), so no download happens.
'use strict'

const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')

const desktop = path.resolve(__dirname, '..')
const repo = path.resolve(desktop, '..')
const packaged = process.argv.includes('--packaged')

let electron
try {
  electron = createRequire(path.join(repo, 'frontend', 'package.json'))('@playwright/test')._electron
} catch {
  console.error('Playwright not found - run setup.bat (it installs frontend/node_modules).')
  process.exit(1)
}

const portFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sumtalk-smoke-'))
  const env = { ...process.env, PRELOAD_MODEL: 'false', AI_MOCK: 'true', DATA_DIR: dataDir }
  delete env.ELECTRON_RUN_AS_NODE
  const launch = packaged
    ? { executablePath: path.join(desktop, 'dist', 'win-unpacked', 'SumTalk.exe'), args: [] }
    : { executablePath: path.join(desktop, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [desktop] }
  if (!fs.existsSync(launch.executablePath)) throw new Error(`Not found: ${launch.executablePath}`)

  const started = Date.now()
  const app = await electron.launch({ ...launch, args: [...launch.args, '--use-fake-device-for-media-stream'], env })
  try {
    const page = await app.firstWindow()
    await page.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//, { timeout: 90_000 })
    await page.getByRole('link', { name: 'Meetings' }).first().waitFor({ timeout: 30_000 })
    check('app loads from the local backend', true, `${page.url()} in ${Date.now() - started} ms`)

    const bridge = await page.evaluate(() => window.sumtalkDesktop)
    check('desktop bridge is exposed', bridge?.platform === process.platform, JSON.stringify(bridge))
    check('no Node.js in the page', (await page.evaluate(() => typeof require)) === 'undefined')
    check(
      'no service worker',
      (await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)) === 0,
    )

    const mic = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const count = stream.getAudioTracks().length
      stream.getTracks().forEach((track) => track.stop())
      return count
    })
    check('microphone is allowed', mic === 1)

    if (process.platform === 'win32') {
      const display = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          const audio = stream.getAudioTracks().length
          stream.getTracks().forEach((track) => track.stop())
          return audio
        } catch (error) {
          return `${error.name}: ${error.message}`
        }
      })
      check('system audio capture (meeting audio) works', display === 1, String(display))
    }

    const port = Number(new URL(page.url()).port)
    const exited = new Promise((resolve) => app.process().once('exit', resolve))
    await page.evaluate(() => window.close())
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 20_000))])
    check('app quits when the window closes', app.process().exitCode !== null)
    let free = false
    for (let i = 0; i < 40 && !(free = await portFree(port)); i++) await new Promise((r) => setTimeout(r, 250))
    check('backend stops with the app', free, `port ${port}`)
  } finally {
    if (app.process().exitCode === null) await app.close().catch(() => undefined)
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5 })
  }
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
    process.exit(failures ? 1 : 0)
  })
  .catch((error) => {
    console.error('FAIL ', error)
    process.exit(1)
  })
