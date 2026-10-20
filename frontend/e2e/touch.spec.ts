// @req REQ-UBI-13
// @req REQ-EVT-06
import type { Page } from '@playwright/test'

import { expect, test } from './support/fixtures.ts'
import { offerInstallation, openApp, tab } from './support/app.ts'
import { findSmallTargets, MINIMUM_TARGET_PX } from './support/audit.ts'

const TABS = ['Presets', 'Parameters', 'Describe', 'Report'] as const

// A phone held upright, with a touch screen: the situation REQ-UBI-13 is about.
test.use({ hasTouch: true, viewport: { width: 375, height: 812 } })

async function expectCoarsePointer(page: Page): Promise<void> {
  // The 44 px rules apply under `pointer: coarse`. If the emulation did not
  // switch it on, the audit below would measure the mouse layout and prove nothing.
  expect(
    await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches),
    'touch emulation should report a coarse pointer',
  ).toBe(true)
}

test.describe(`REQ-UBI-13: every control is at least ${MINIMUM_TARGET_PX} px on a touch screen`, () => {
  test('on each of the four tabs, including the header and the viewer toolbar', async ({ page }) => {
    await openApp(page)
    // The Install control is part of the header the user touches.
    await offerInstallation(page)
    await expectCoarsePointer(page)

    for (const name of TABS) {
      await tab(page, new RegExp(`^${name}`)).tap()
      await expect(tab(page, new RegExp(`^${name}`))).toHaveAttribute('aria-selected', 'true')
      expect(await findSmallTargets(page), `controls under ${MINIMUM_TARGET_PX} px on the ${name} tab`).toEqual([])
    }
  })

  test('in the View sheet, with the section controls open', async ({ page }) => {
    await openApp(page)
    await expectCoarsePointer(page)

    await page.getByRole('button', { name: 'View options' }).tap()
    const sheet = page.getByRole('dialog', { name: 'View options' })
    await expect(sheet).toBeVisible()
    expect(await findSmallTargets(page, { within: 'dialog[open]' }), 'controls in the sheet').toEqual([])

    // The section plane adds an axis switch and a slider to the sheet.
    await sheet.getByRole('button', { name: 'Section plane' }).tap()
    await expect(sheet.getByRole('slider', { name: 'Section cutting plane offset' })).toBeVisible()
    expect(
      await findSmallTargets(page, { within: 'dialog[open]' }),
      'controls in the sheet with the section plane on',
    ).toEqual([])
  })
})
