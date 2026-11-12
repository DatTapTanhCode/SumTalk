// SumTalk desktop app (Electron).
//
// Starts the Python backend on 127.0.0.1 (the same FastAPI server that start.bat runs), waits until it
// answers, then shows the app it serves in a window. The backend is stopped when the window closes.
//
//   From source (repo checkout after setup.bat):  desktop.bat   or   cd desktop && npm start
//     -> uses backend/.venv, backend/data, backend/.env and the built frontend/dist.
//   Packaged (build-desktop.bat):                 SumTalk-Setup-<version>.exe
//     -> backend frozen with PyInstaller in resources/backend, web app in resources/web,
//        data + settings in %LOCALAPPDATA%\SumTalk.
//
// Environment overrides (development):
//   SUMTALK_PORT      backend port (default 47821; keep it stable, browser storage is tied to it)
//   SUMTALK_PYTHON    Python interpreter to run backend/run.py with (default backend/.venv)
//   SUMTALK_DEV_URL   load the UI from the Vite dev server instead, e.g. http://localhost:5173
//                     (start Vite with API_TARGET=http://127.0.0.1:47821 so /api reaches this backend)
'use strict'

const { app, BrowserWindow, Menu, desktopCapturer, dialog, session, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { Backend, findPort } = require('./lib/backend')

const APP_ID = 'com.sumtalk.desktop'
const PREFERRED_PORT = Number(process.env.SUMTALK_PORT) || 47821
const DEV_URL = process.env.SUMTALK_DEV_URL || null
const REPO = path.resolve(__dirname, '..')
const IS_WIN = process.platform === 'win32'

// A source checkout keeps its own browser profile, so offline recordings queued against the
// development backend are never uploaded to the installed app's backend (or the other way round).
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'SumTalk-dev'))
app.setAppUserModelId(APP_ID)

const paths = (() => {
  if (app.isPackaged) {
    const root = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'SumTalk')
    return {
      data: path.join(root, 'data'),
      settings: path.join(root, 'sumtalk.env'),
      settingsTemplate: path.join(process.resourcesPath, 'sumtalk.env.example'),
      log: path.join(root, 'logs', 'backend.log'),
    }
  }
  return {
    data: path.join(REPO, 'backend', 'data'),
    settings: path.join(REPO, 'backend', '.env'),
    settingsTemplate: path.join(REPO, 'backend', '.env.example'),
    log: path.join(REPO, 'backend', 'data', 'logs', 'desktop-backend.log'),
  }
})()

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {Backend | null} */
let backend = null
let backendUrl = null
let ready = false
let quitting = false
const trustedOrigins = new Set()

// ---------------------------------------------------------------------------------------------
// Backend

function backendLaunchSpec(port) {
  const args = ['--port', String(port), '--parent-watch']
  const env = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
  if (app.isPackaged) {
    const dir = path.join(process.resourcesPath, 'backend')
    Object.assign(env, {
      DATA_DIR: paths.data,
      FRONTEND_DIST: path.join(process.resourcesPath, 'web'),
      SUMTALK_ENV_FILE: paths.settings,
    })
    return { command: path.join(dir, IS_WIN ? 'sumtalk-server.exe' : 'sumtalk-server'), args, cwd: dir, env }
  }
  const python =
    process.env.SUMTALK_PYTHON ||
    path.join(REPO, 'backend', '.venv', IS_WIN ? 'Scripts' : 'bin', IS_WIN ? 'python.exe' : 'python')
  return { command: python, args: [path.join(REPO, 'backend', 'run.py'), ...args], cwd: path.join(REPO, 'backend'), env }
}

function checkInstallation(spec) {
  if (!fs.existsSync(spec.command)) {
    throw new Error(
      app.isPackaged
        ? `The SumTalk engine is missing (${spec.command}). Reinstall SumTalk.`
        : `Python environment not found (${spec.command}).\nRun setup.bat first.`,
    )
  }
  const web = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(REPO, 'frontend', 'dist')
  if (!DEV_URL && !fs.existsSync(path.join(web, 'index.html'))) {
    throw new Error(
      app.isPackaged
        ? 'The app files are missing. Reinstall SumTalk.'
        : 'The web app is not built yet.\nRun setup.bat (or: cd frontend && npm run build).',
    )
  }
  ensureSettingsFile()
}

/** The installed app gets an editable copy of .env.example on first start. */
function ensureSettingsFile() {
  if (fs.existsSync(paths.settings) || !app.isPackaged) return
  fs.mkdirSync(path.dirname(paths.settings), { recursive: true })
  if (fs.existsSync(paths.settingsTemplate)) fs.copyFileSync(paths.settingsTemplate, paths.settings)
}

function onBackendExit({ code }) {
  if (!ready || quitting) return // start-up failures are reported by startup()
  ready = false
  const choice = dialog.showMessageBoxSync(mainWindow ?? undefined, {
    type: 'error',
    title: 'SumTalk',
    message: 'The SumTalk engine stopped unexpectedly.',
    detail: `Exit code ${code}.\n\n${backend?.recentOutput().split('\n').slice(-12).join('\n') ?? ''}\n\nLog: ${paths.log}`,
    buttons: ['Restart SumTalk', 'Open log', 'Quit'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  })
  if (choice === 1) void shell.openPath(paths.log)
  if (choice === 0) app.relaunch()
  app.quit()
}

// ---------------------------------------------------------------------------------------------
// Window

function isTrusted(url) {
  try {
    return trustedOrigins.has(new URL(url).origin)
  } catch {
    return false
  }
}

function configureSession() {
  const ses = session.defaultSession

  // Microphone, clipboard, wake lock... only for the app itself, never for anything else.
  ses.setPermissionRequestHandler((webContents, _permission, callback, details) => {
    callback(isTrusted(details.requestingUrl || webContents.getURL()))
  })
  ses.setPermissionCheckHandler((_webContents, _permission, requestingOrigin) => isTrusted(requestingOrigin))

  // "Microphone + meeting audio": the browser version asks the user to share a tab. Here we answer
  // getDisplayMedia() directly with the screen + the system audio output (WASAPI loopback), so the
  // voices of a Zoom / Teams / Meet call in any app are recorded. The video track is dropped by the app.
  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (!isTrusted(request.securityOrigin || request.frame?.url || '')) return callback({})
      desktopCapturer
        .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          if (!sources.length) return callback({})
          callback(IS_WIN ? { video: sources[0], audio: 'loopback' } : { video: sources[0] })
        })
        .catch(() => callback({}))
    },
    { useSystemPicker: false },
  )

  // Exports and audio downloads: ask where to save, starting in Downloads.
  ses.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) })
  })
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 400,
    minHeight: 560,
    show: false,
    title: 'SumTalk',
    backgroundColor: '#f2f2f0',
    icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // Keep recording, uploading chunks and polling at full speed while minimised.
      backgroundThrottling: false,
    },
  })
  window.once('ready-to-show', () => window.show())

  // Links to other sites open in the default browser; the app itself never leaves its origin.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isTrusted(url) || url.startsWith('file:')) return
    event.preventDefault()
    if (/^https?:/i.test(url)) void shell.openExternal(url)
  })

  // The Record page blocks unloading while recording (beforeunload). Electron would just refuse to
  // close silently, so ask the user like a browser does.
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'SumTalk',
      message: 'A recording is in progress.',
      detail:
        'Stop the recording first so it is saved and transcribed right away.\n\n' +
        'If you leave now, the audio recorded so far stays on this computer and is processed the next time SumTalk opens.',
      buttons: ['Keep recording', 'Leave anyway'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    if (choice === 1) event.preventDefault() // ignore beforeunload and go ahead
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit' && !quitting && ready) window.reload()
  })

  window.on('closed', () => {
    mainWindow = null
  })
  return window
}

function setStatus(text) {
  mainWindow?.webContents.executeJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(text)})`).catch(() => undefined)
}

// ---------------------------------------------------------------------------------------------
// Menu

function appUrl(pathname = '/') {
  return new URL(pathname, DEV_URL || backendUrl).toString()
}

function openSettings() {
  if (!fs.existsSync(paths.settings)) {
    fs.mkdirSync(path.dirname(paths.settings), { recursive: true })
    if (fs.existsSync(paths.settingsTemplate)) fs.copyFileSync(paths.settingsTemplate, paths.settings)
    else fs.writeFileSync(paths.settings, '')
  }
  void shell.openPath(paths.settings)
  dialog.showMessageBox(mainWindow ?? undefined, {
    type: 'info',
    title: 'SumTalk settings',
    message: 'Settings opened in your text editor.',
    detail: 'Save the file, then choose File > Restart SumTalk to apply the changes.\n\n' + paths.settings,
    noLink: true,
  })
}

function showAbout() {
  dialog.showMessageBox(mainWindow ?? undefined, {
    type: 'info',
    title: 'About SumTalk',
    message: `SumTalk ${app.getVersion()}`,
    detail: [
      'Meeting transcription, summary & translation. Speech recognition runs on this computer.',
      '',
      `Engine: ${backendUrl ?? 'not running'}`,
      `Data: ${paths.data}`,
      `Settings: ${paths.settings}`,
      `Electron ${process.versions.electron} - Chromium ${process.versions.chrome}`,
    ].join('\n'),
    noLink: true,
  })
}

function buildMenu() {
  const needsBackend = () => Boolean(backendUrl)
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Settings…', click: openSettings },
        { label: 'Open data folder', click: () => void shell.openPath(paths.data) },
        { label: 'Open engine log', click: () => void shell.openPath(paths.log) },
        { type: 'separator' },
        {
          label: 'Restart SumTalk',
          click: () => {
            app.relaunch()
            app.quit()
          },
        },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Open in web browser', click: () => needsBackend() && void shell.openExternal(appUrl('/')) },
        { label: 'API documentation', click: () => needsBackend() && void shell.openExternal(new URL('/docs', backendUrl).toString()) },
        { type: 'separator' },
        { label: 'About SumTalk', click: showAbout },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------------------------
// Lifecycle

async function startup() {
  buildMenu()
  configureSession()
  mainWindow = createWindow()
  await mainWindow.loadFile(path.join(__dirname, 'loading.html'))

  try {
    const port = await findPort(PREFERRED_PORT)
    const spec = backendLaunchSpec(port)
    checkInstallation(spec)

    backendUrl = `http://127.0.0.1:${port}`
    trustedOrigins.add(new URL(backendUrl).origin)
    if (DEV_URL) trustedOrigins.add(new URL(DEV_URL).origin)

    backend = new Backend({ ...spec, logFile: paths.log, echo: !app.isPackaged })
    backend.on('exit', onBackendExit)
    backend.start()
    setStatus('Starting the speech engine…')
    await backend.waitUntilReady(port, 120_000)
    ready = true

    if (!mainWindow) return // closed while starting
    await mainWindow.loadURL(appUrl('/'))
    const history = mainWindow.webContents.navigationHistory
    if (history?.clear) history.clear() // no "back" to the loading screen
  } catch (error) {
    if (quitting) return // the window was closed while starting
    const output = backend?.recentOutput().split('\n').slice(-12).join('\n')
    const choice = dialog.showMessageBoxSync(mainWindow ?? undefined, {
      type: 'error',
      title: 'SumTalk',
      message: 'SumTalk could not start.',
      detail: `${error instanceof Error ? error.message : error}${output ? `\n\n${output}` : ''}\n\nLog: ${paths.log}`,
      buttons: ['Quit', 'Open log'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
    if (choice === 1) await shell.openPath(paths.log)
    app.quit()
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit() // SumTalk is already open: the running instance shows its window (second-instance)
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(startup)

  app.on('window-all-closed', () => app.quit())

  // Runs after every window has closed (so a cancelled close - "Keep recording" - never gets here).
  app.on('will-quit', (event) => {
    quitting = true
    if (backend?.running) {
      event.preventDefault()
      backend.stop().finally(() => app.quit())
    }
  })
}
