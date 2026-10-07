import { expect, test } from '@playwright/test'

test('records a meeting in the browser with a live transcript, then saves it', async ({ page }) => {
  await page.goto('/record')
  await page.getByLabel('Title').fill('Browser recording test')
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Recording', { exact: true })).toBeVisible()

  // Live transcript of the fake microphone (an English speech file).
  await expect(page.getByText(/project meeting/i).first()).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused', { exact: true })).toBeVisible()
  await page.waitForTimeout(600) // the display refreshes every 250 ms and the last ~100 ms of audio is still arriving
  const pausedAt = await page.getByTestId('timer').textContent()
  await page.waitForTimeout(2000)
  await expect(page.getByTestId('timer')).toHaveText(pausedAt ?? '') // timer stops while paused
  await page.getByRole('button', { name: 'Resume' }).click()
  await page.waitForTimeout(6000)

  await page.getByRole('button', { name: 'Stop and save' }).click()
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Browser recording test' })).toBeVisible()
  await expect(page.getByText(/sprint backlog/i).first()).toBeVisible()
  await expect(page.locator('audio')).toBeVisible()
})

test('records microphone + meeting (tab/system) audio mixed together', async ({ page }) => {
  // With --use-fake-ui-for-media-stream the screen-share prompt is auto-accepted with a fake audio track.
  await page.goto('/record')
  await page.getByLabel('Title').fill('Online meeting test')
  await page.getByRole('button', { name: /Microphone \+ meeting audio/ }).click()
  await expect(page.getByText(/Share tab audio/)).toBeVisible()
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Mic + meeting audio')).toBeVisible()
  await expect(page.getByText(/project meeting/i).first()).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Stop and save' }).click()
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Recorded · mic + meeting audio')).toBeVisible()
})

test('uploads an existing audio file and creates a meeting from it', async ({ page }) => {
  await page.goto('/upload')
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/speech_en.mp3')
  await expect(page.getByLabel('Meeting title')).toHaveValue('speech_en')
  await page.getByRole('button', { name: /Upload & transcribe/ }).click()
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText(/upload screen and the mobile app/i).first()).toBeVisible()
  await expect(page.getByText(/English/).first()).toBeVisible() // detected language
})

test('rejects unsupported files before uploading anything', async ({ page }) => {
  await page.goto('/upload')
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByText(/files are not supported/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Upload & transcribe/ })).toHaveCount(0)
})

test('keeps recording offline and uploads automatically when the connection returns', async ({ page, context }) => {
  await page.goto('/record')
  await page.getByLabel('Title').fill('Offline recording test')
  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByText('Recording', { exact: true })).toBeVisible()
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await expect(page.getByText('Offline - later')).toBeVisible()
  await page.waitForTimeout(8000) // these chunks can only go to IndexedDB
  await page.getByRole('button', { name: 'Stop and save' }).click()
  await expect(page.getByText('Saved on this device')).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Offline recording test' })).toBeVisible()
  await expect(page.getByText(/morning/i).first()).toBeVisible()
})
