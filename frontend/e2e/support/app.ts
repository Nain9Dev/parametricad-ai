import type { Locator, Page } from '@playwright/test'

import { expect } from './fixtures.ts'

/**
 * The four bundled parts: the card that opens each one, and the bounding box the
 * Properties panel reports for it (`PropertiesPanel` prints `size.toFixed(1)`).
 * The sizes are those of `public/presets/*.json`, in millimetres.
 */
export const PRESETS = [
  { id: 'flange', card: /Brida 8 Pernos/, box: '100.0 x 100.0 x 12.0 mm' },
  { id: 'elbow', card: /Codo 90°/, box: '82.5 x 82.5 x 25.0 mm' },
  { id: 'pipe', card: /Tubo Extruido/, box: '25.0 x 25.0 x 200.0 mm' },
  { id: 'plate', card: /Placa Mecanizada/, box: '120.0 x 80.0 x 10.0 mm' },
] as const

export type Preset = (typeof PRESETS)[number]

/** The flange card is the one the app opens on, and the first of the four. */
export const FLANGE: Preset = PRESETS[0]

/** The viewer announces "Model ready." once the generated mesh is on the canvas. */
export function viewerStatus(page: Page): Locator {
  return page.locator('main p[aria-live="polite"]')
}

export async function expectModelReady(page: Page): Promise<void> {
  await expect(viewerStatus(page)).toHaveText('Model ready.')
}

/** The bounding box row of the Properties panel, as the user reads it. */
export function boundingBox(page: Page): Locator {
  return page.locator('dt', { hasText: /^Bounding box$/ }).locator('xpath=following-sibling::dd[1]')
}

export function presetCard(page: Page, preset: Preset): Locator {
  return page.getByRole('button', { name: preset.card })
}

export function tab(page: Page, name: string | RegExp): Locator {
  return page.getByRole('tab', { name })
}

/** Open the application and wait until the first part is on the canvas. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'ParametriCAD' })).toBeVisible()
  await expectModelReady(page)
}

/** The worker is active and has taken the page over (`clientsClaim`). */
export async function expectControlledByWorker(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null), {
      message: 'the service worker should be active and controlling the page',
    })
    .toBe('activated')
}

/**
 * Chrome offers installation by firing `beforeinstallprompt`. Headless Chromium
 * never does, so the event is sent by hand: enough to put the Install control in
 * the header, not enough to prove Chrome's own prompt (that stays with TSK-29).
 */
export async function offerInstallation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const offer = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(offer, {
      prompt: () => Promise.resolve(),
      userChoice: new Promise(() => {}),
    })
    window.dispatchEvent(offer)
  })
  await expect(page.getByRole('button', { name: 'Install app' })).toBeVisible()
}
