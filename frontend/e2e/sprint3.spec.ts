import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// Sprint 3: #99 summary and #100 translation, end to end in the browser.
// Start the server with the mock LLM so answers are predictable and nothing is sent to a model:
//   AI_MOCK=true python backend/run.py            (PowerShell: $env:AI_MOCK='true'; python backend/run.py)
// The mock writes "Bản tóm tắt thử nghiệm (mock)…" / "Mock summary…" and translates a line as "[vi] <line>".

async function uploadMeeting(page: Page): Promise<string> {
  await page.goto('/upload')
  await page.locator('input[type=file]').setInputFiles('e2e/fixtures/speech_en.mp3')
  await page.getByLabel('Meeting title').fill('Sprint 3 e2e')
  await page.getByRole('button', { name: /Upload & transcribe/ }).click()
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 120_000 })
  return page.url().split('/').at(-1)!
}

test.describe('Sprint 3 - summary and translation (server started with AI_MOCK=true)', () => {
  let meetingId: string | undefined

  test.beforeAll(async ({ request }) => {
    const config = await (await request.get('/api/config')).json()
    test.skip(!config.ai_mock, 'start the server with AI_MOCK=true')
  })

  test.afterEach(async ({ request }) => {
    if (meetingId) await request.delete(`/api/meetings/${meetingId}`)
    meetingId = undefined
  })

  test('#99 summary is created automatically, has key points and decisions, Regenerate replaces it', async ({ page }) => {
    meetingId = await uploadMeeting(page)
    await page.getByRole('tab', { name: 'Summary' }).click()

    const summary = page.getByTestId('summary')
    await expect(summary.getByText(/Bản tóm tắt thử nghiệm/)).toBeVisible({ timeout: 30_000 }) // default language: vi
    await expect(summary.getByText('Key points')).toBeVisible()
    await expect(summary.getByText('Decisions')).toBeVisible()
    await expect(summary.getByText('Action items')).toBeVisible()

    await page.getByRole('button', { name: /Regenerate/ }).click()
    await page.getByRole('menuitem', { name: 'English' }).click()
    await expect(page.getByText('The current summary will be replaced')).toBeVisible()
    await page.getByRole('button', { name: 'Regenerate', exact: true }).click()
    await expect(summary.getByText(/^Mock summary/)).toBeVisible({ timeout: 30_000 })
    await expect(summary.getByText(/Bản tóm tắt thử nghiệm/)).toHaveCount(0)
  })

  test('#100 translation side by side, kept after reload without a new job, exported as TXT / SRT', async ({ page, request }) => {
    meetingId = await uploadMeeting(page)
    await page.getByRole('tab', { name: 'Translation' }).click()
    await page.getByLabel('Target language').selectOption('vi')

    const table = page.getByTestId('translation-table')
    await expect(table.getByText(/^\[vi\] /).first()).toBeVisible({ timeout: 30_000 })
    await expect(table.getByRole('columnheader', { name: 'Original' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export' })).toBeEnabled({ timeout: 30_000 })

    const detail = await (await request.get(`/api/meetings/${meetingId}/translations/vi`)).json()
    expect(detail.status).toBe('done')
    expect(detail.segments.length).toBeGreaterThan(0)
    expect(detail.segments.every((s: { translation: string | null }) => s.translation)).toBe(true)

    // Reload: the saved translation is shown again, nothing is translated again.
    await page.reload()
    await page.getByRole('tab', { name: 'Translation' }).click()
    await expect(table.getByText(/^\[vi\] /).first()).toBeVisible()
    const after = await (await request.get(`/api/meetings/${meetingId}/translations`)).json()
    expect(after).toHaveLength(1)
    expect(after[0].updated_at).toBe(detail.updated_at)

    for (const [label, ext] of [['Text (.txt)', 'txt'], ['Subtitles (.srt)', 'srt']] as const) {
      await page.getByRole('button', { name: 'Export' }).click()
      const download = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: label }).click()
      const file = await download
      expect(file.suggestedFilename()).toBe(`Sprint 3 e2e_vi.${ext}`)
      const text = (await readFile((await file.path())!)).toString('utf-8')
      expect(text).toContain('[vi] ')
      if (ext === 'srt') expect(text).toMatch(/^1\n\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}\n/)
      else expect(text.charCodeAt(0)).toBe(0xfeff)
    }
  })
})
