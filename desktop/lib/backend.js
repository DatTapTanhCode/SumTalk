// Starts, watches and stops the SumTalk backend (FastAPI + Whisper) that serves the app on 127.0.0.1.
'use strict'

const { EventEmitter } = require('node:events')
const { execFile, spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

const TAIL_LINES = 40

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

/**
 * The web storage of the app (offline recordings in IndexedDB, cached settings) belongs to its
 * origin, which includes the port. So we always try the same port first and only move on when
 * something else holds it.
 */
async function findPort(preferred, attempts = 20) {
  for (let port = preferred; port < preferred + attempts; port++) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`No free port between ${preferred} and ${preferred + attempts - 1}.`)
}

function checkHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 2000 }, (response) => {
      response.resume()
      if (response.statusCode === 200) resolve()
      else reject(new Error(`HTTP ${response.statusCode}`))
    })
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', reject)
  })
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class Backend extends EventEmitter {
  /**
   * @param {{command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, logFile: string, echo?: boolean}} options
   */
  constructor(options) {
    super()
    this.options = options
    this.child = null
    this.exitInfo = null // {code, signal} once the process has ended
    this.spawnError = null
    this.tail = []
    this.stopping = null
  }

  get running() {
    return Boolean(this.child) && !this.exitInfo
  }

  start() {
    const { command, args, cwd, env, logFile, echo } = this.options
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    try {
      fs.renameSync(logFile, logFile.replace(/\.log$/, '.previous.log'))
    } catch {
      // first start
    }
    this.log = fs.createWriteStream(logFile, { flags: 'w' })
    this.log.write(`[desktop] ${new Date().toISOString()} starting: ${command} ${args.join(' ')}\n`)

    // stdin stays open and unused: the backend (run.py --parent-watch) exits when it closes,
    // which also happens if this app crashes - no orphaned server left behind.
    this.child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdin.on('error', () => undefined) // EPIPE if the backend is already gone
    const onOutput = (data) => {
      this.log.write(data)
      if (echo) process.stdout.write(data)
      this.tail.push(...data.toString('utf8').split(/\r?\n/).filter(Boolean))
      if (this.tail.length > TAIL_LINES) this.tail.splice(0, this.tail.length - TAIL_LINES)
    }
    this.child.stdout.on('data', onOutput)
    this.child.stderr.on('data', onOutput)
    this.child.on('error', (error) => {
      // e.g. ENOENT: the executable does not exist. 'exit' may not follow, so end here.
      this.spawnError = error
      this.log.write(`[desktop] could not start: ${error.message}\n`)
      if (!this.exitInfo) this.finish(null, null)
    })
    this.child.on('exit', (code, signal) => this.finish(code, signal))
  }

  finish(code, signal) {
    if (this.exitInfo) return
    this.exitInfo = { code, signal }
    this.log?.write(`[desktop] backend exited (code ${code}, signal ${signal})\n`)
    this.log?.end()
    this.emit('exit', this.exitInfo)
  }

  /** Resolves once GET /api/health answers; rejects if the process ends or takes too long. */
  async waitUntilReady(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (this.exitInfo) {
        const reason = this.spawnError
          ? `Could not run ${this.options.command}: ${this.spawnError.message}`
          : `The SumTalk engine stopped during start-up (exit code ${this.exitInfo.code}).`
        throw new Error(reason)
      }
      try {
        await checkHealth(port)
        return
      } catch {
        await sleep(250)
      }
    }
    throw new Error(`The SumTalk engine did not answer within ${Math.round(timeoutMs / 1000)} s.`)
  }

  recentOutput() {
    return this.tail.join('\n')
  }

  /** Graceful shutdown (close stdin), then force after `graceMs`. Safe to call more than once. */
  stop(graceMs = 8000) {
    if (!this.running) return Promise.resolve()
    if (this.stopping) return this.stopping
    this.stopping = new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.forceKill()
        setTimeout(resolve, 500)
      }, graceMs)
      this.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
      this.child.stdin.end()
    })
    return this.stopping
  }

  forceKill() {
    if (!this.running) return
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(this.child.pid), '/T', '/F'], { windowsHide: true }, () => undefined)
    } else {
      this.child.kill('SIGKILL')
    }
  }
}

module.exports = { Backend, findPort }
