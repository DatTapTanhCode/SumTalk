import { defineConfig } from '@playwright/test'
import path from 'node:path'

// Browser tests run against a started server (python backend/run.py) and the installed
// Chrome / Edge. The "microphone" is a WAV file of English speech, so real transcripts come back.
const speech = path.resolve('e2e/fixtures/speech_en.wav')
const fakeMicrophone = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${speech}`,
]

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chrome', use: { channel: 'chrome', launchOptions: { args: fakeMicrophone } } },
    { name: 'msedge', use: { channel: 'msedge', launchOptions: { args: fakeMicrophone } } },
  ],
})
