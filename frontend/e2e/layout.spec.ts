// @req REQ-UBI-12
// @req REQ-UBI-14
// @req REQ-EVT-06
// @req REQ-UBI-19
import type { Locator, Page } from '@playwright/test'

import { expect, test } from './support/fixtures.ts'
import { offerInstallation, openApp, tab } from './support/app.ts'
import { findClippedByViewportEdge } from './support/audit.ts'

interface ViewportCase {
  name: string
  width: number
  height: number
  layout: 'compact portrait' | 'compact landscape' | 'wide'
  /** The ecosystem bar is drawn: from 640 px wide, and not on a short screen. */
  bar: boolean
}

const CASES: readonly ViewportCase[] = [
  { name: '320 x 568', width: 320, height: 568, layout: 'compact portrait', bar: false },
  { name: '360 x 640', width: 360, height: 640, layout: 'compact portrait', bar: false },
  { name: '375 x 812', width: 375, height: 812, layout: 'compact portrait', bar: false },
  { name: '812 x 375', width: 812, height: 375, layout: 'compact landscape', bar: false },
  { name: '768 x 1024', width: 768, height: 1024, layout: 'compact portrait', bar: true },
  { name: '1280 x 800', width: 1280, height: 800, layout: 'wide', bar: true },
]

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${String(locator)} is not drawn`)
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height }
}

/** The verdict chip over the viewer (REQ-UBI-19); the card in the report is not a button. */
function verdictChip(page: Page): Locator {
  return page.getByRole('main').getByRole('button', { name: /^Valid/ })
}

/** True when the point at the middle of `locator` belongs to `locator` (or inside it). */
function isOnTop(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return hit !== null && element.contains(hit)
  })
}

for (const viewport of CASES) {
  test.describe(`REQ-UBI-12, REQ-UBI-14 and REQ-EVT-06 at ${viewport.name} (${viewport.layout})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('nothing overflows, the viewer is visible and the header is not covered', async ({ page }) => {
      await openApp(page)
      // The Install control is the widest thing the header can hold.
      await offerInstallation(page)

      // No horizontal overflow, no page scroll, nothing cut off at the edge.
      const extent = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }))
      expect(extent.scrollWidth, 'page width').toBeLessThanOrEqual(extent.width)
      expect(extent.scrollHeight, 'page height').toBeLessThanOrEqual(extent.height)
      expect(await findClippedByViewportEdge(page), 'boxes cut by the screen edge').toEqual([])

      // The viewer is drawn, fully on screen, and nothing sits on top of it.
      const canvas = page.locator('main canvas')
      await expect(canvas).toBeVisible()
      const canvasBox = await boxOf(canvas)
      expect(canvasBox.left).toBeGreaterThanOrEqual(0)
      expect(canvasBox.top).toBeGreaterThanOrEqual(0)
      expect(canvasBox.right).toBeLessThanOrEqual(extent.width)
      expect(canvasBox.bottom).toBeLessThanOrEqual(extent.height)
      expect(canvasBox.right - canvasBox.left, 'viewer width').toBeGreaterThanOrEqual(200)
      expect(canvasBox.bottom - canvasBox.top, 'viewer height').toBeGreaterThanOrEqual(150)
      expect(await isOnTop(canvas), 'something covers the viewer').toBe(true)

      // The header is not under the ecosystem bar, which is drawn only where it fits.
      const heading = page.getByRole('heading', { level: 1, name: 'ParametriCAD' })
      expect(await isOnTop(heading), 'something covers the header').toBe(true)
      const bar = page.locator('nain-ecosystem-bar')
      if (viewport.bar) {
        await expect(bar).toBeVisible()
        const header = await boxOf(page.getByRole('banner'))
        expect((await boxOf(bar)).bottom, 'the bar ends where the header starts').toBeLessThanOrEqual(
          header.top + 0.5,
        )
      } else {
        await expect(bar).toBeHidden()
      }
    })

    if (viewport.layout === 'wide') {
      test('the three columns stand side by side and there are no tabs', async ({ page }) => {
        await openApp(page)

        await expect(page.getByRole('tablist')).toHaveCount(0)
        const inputs = await boxOf(page.getByRole('complementary').first())
        const viewer = await boxOf(page.getByRole('main'))
        const report = await boxOf(page.getByRole('complementary').last())
        expect(inputs.right).toBeLessThanOrEqual(viewer.left + 0.5)
        expect(viewer.right).toBeLessThanOrEqual(report.left + 0.5)

        // The verdict is read from the Mesh validation card; no chip repeats it.
        await expect(page.getByRole('heading', { name: 'Mesh validation' })).toBeVisible()
        await expect(verdictChip(page)).toHaveCount(0)
      })
    } else {
      test('the four tabs are there and the compact toolbar fits', async ({ page }) => {
        await openApp(page)

        const tabs = page.getByRole('tab')
        await expect(tabs).toHaveText(['Presets', 'Parameters', 'Describe', /^Report/])
        const tablist = await boxOf(page.getByRole('tablist'))
        const viewer = await boxOf(page.getByRole('main'))
        if (viewport.layout === 'compact portrait') {
          // Viewer above the tabs, the whole width each.
          expect(viewer.bottom).toBeLessThanOrEqual(tablist.top + 0.5)
        } else {
          // Viewer on the left, tabs on the right.
          expect(viewer.right).toBeLessThanOrEqual(tablist.left + 0.5)
        }

        // Presets, Fit and View in one row, in order, none over another, none past the edge.
        const strip = [
          page.getByRole('group', { name: 'Camera orientation presets' }),
          page.getByRole('button', { name: 'Fit camera to geometry bounds' }),
          page.getByRole('button', { name: 'View options' }),
        ]
        const boxes: Box[] = []
        for (const control of strip) {
          await expect(control).toBeVisible()
          boxes.push(await boxOf(control))
        }
        for (const [index, box] of boxes.entries()) {
          const next = boxes[index + 1]
          expect(box.right, `control ${index + 1} stays on screen`).toBeLessThanOrEqual(viewport.width)
          if (next) expect(box.right, `control ${index + 1} ends before the next`).toBeLessThanOrEqual(next.left + 0.5)
        }
        const row = page.getByRole('group', { name: 'Camera orientation presets' }).locator('xpath=..')
        expect(
          await row.evaluate((element) => element.scrollWidth <= element.clientWidth),
          'the toolbar row is not scrolling sideways',
        ).toBe(true)
      })

      test('the verdict of the first part is drawn over the viewer and opens the Report tab', async ({
        page,
      }) => {
        await openApp(page)

        const chip = verdictChip(page)
        await expect(chip).toBeVisible()
        await expect(chip).toContainText('3,392 triangles')

        // Inside the canvas, in its lower half, clear of its centre and of the
        // progress pill drawn at the top while a part is being generated.
        const canvas = await boxOf(page.locator('main canvas'))
        const box = await boxOf(chip)
        expect(box.left).toBeGreaterThanOrEqual(canvas.left)
        expect(box.right).toBeLessThanOrEqual(canvas.right)
        expect(box.bottom).toBeLessThanOrEqual(canvas.bottom)
        expect(box.top, 'the chip leaves the centre of the canvas clear').toBeGreaterThan(
          (canvas.top + canvas.bottom) / 2,
        )

        await chip.click()
        await expect(tab(page, /^Report/)).toHaveAttribute('aria-selected', 'true')
      })
    }
  })
}
