// @req REQ-UBI-11
// @req REQ-STA-04
import { expect, test } from './support/fixtures.ts'
import {
  boundingBox,
  expectControlledByWorker,
  expectModelReady,
  FLANGE,
  openApp,
  PRESETS,
  presetCard,
} from './support/app.ts'

test.describe('REQ-UBI-11 and REQ-STA-04: the installed app opens with no connection', () => {
  test('a reload with the network off serves the shell, the Offline badge and all four presets', async ({
    page,
    context,
  }) => {
    await openApp(page)
    await expectControlledByWorker(page)

    // Off, then reload: only the worker can answer the navigation now.
    await context.setOffline(true)
    const response = await page.reload()
    expect(response?.fromServiceWorker(), 'the worker answered the reload').toBe(true)
    expect(await page.evaluate(() => navigator.onLine)).toBe(false)

    await expect(page.getByRole('heading', { level: 1, name: 'ParametriCAD' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /^Offline$/ })).toBeVisible()
    await expectModelReady(page)
    await expect(boundingBox(page)).toHaveText(FLANGE.box)

    // The flange comes last, so the last step is a real change of model too.
    for (const preset of [...PRESETS.slice(1), FLANGE]) {
      await presetCard(page, preset).click()
      await expect(boundingBox(page), `${preset.id} bounding box`).toHaveText(preset.box)
    }
  })

  test('the Offline badge appears when the connection is lost and goes when it returns', async ({
    page,
    context,
  }) => {
    await openApp(page)
    const offline = page.getByRole('status').filter({ hasText: /^Offline$/ })

    await context.setOffline(true)
    await expect(offline).toBeVisible()

    await context.setOffline(false)
    await expect(offline).toHaveCount(0)
  })
})
