// @req REQ-EVT-07
import type { Page } from '@playwright/test'

import { expect, test } from './support/fixtures.ts'
import { expectControlledByWorker, expectModelReady, openApp } from './support/app.ts'
import { serveBundle } from './support/bundles.ts'

/** The entry script of the page, whose hashed name changes with every build. */
function entryScript(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      [...document.scripts].map((script) => script.src).find((src) => /\/assets\/index-[^/]+\.js$/.test(src)),
  )
}

/** What the browser knows about the worker: who runs, who waits, and whether control moved. */
function workerState(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    const watched = (window as Window & { __controllerChanges?: { count: number } }).__controllerChanges
    return {
      active: registration?.active?.state ?? null,
      waiting: registration?.waiting?.state ?? null,
      controllerChanges: watched?.count ?? null,
    }
  })
}

test.describe('REQ-EVT-07: a new version is announced and applied only when the user accepts', () => {
  // Whatever a test leaves served, the next one starts from the first release.
  test.afterEach(() => serveBundle('a'))

  /** Open the first release, start an edit, deploy the second and wait for the banner. */
  async function deploySecondRelease(page: Page) {
    const serviceCalls: string[] = []
    page.on('request', (request) => {
      const { host } = new URL(request.url())
      if (host.endsWith('.e2e.invalid')) serviceCalls.push(host)
    })

    await openApp(page)
    await expectControlledByWorker(page)
    // A returning visit: the page now starts under the worker, as it does for
    // anyone who has opened the app before and sees a release arrive.
    await page.reload()
    await expectModelReady(page)
    await expectControlledByWorker(page)

    // An edit in progress, which a reload would lose. Live regeneration is off
    // so the edit makes no request of its own.
    await page.getByLabel('Regenerate as I edit').uncheck()
    const diameter = page.getByLabel('Outer diameter', { exact: true })
    await diameter.fill('123')

    await page.evaluate(() => {
      const watched = { count: 0 }
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        watched.count += 1
      })
      Object.assign(window, { __controllerChanges: watched })
    })
    const before = await entryScript(page)

    serveBundle('b')
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update()
    })
    await expect(page.getByText('A new version is available.')).toBeVisible()

    return { diameter, before, serviceCalls }
  }

  test('the old version keeps running until Reload is pressed, then the new one takes over', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const { diameter, before, serviceCalls } = await deploySecondRelease(page)

    // Announced, not applied: the new worker waits, nothing was taken over, the
    // page is the one it was, and the edit is still there.
    expect(await workerState(page)).toEqual({ active: 'activated', waiting: 'installed', controllerChanges: 0 })
    expect(await entryScript(page)).toBe(before)
    await expect(diameter).toHaveValue('123')
    expect(new Set(serviceCalls)).toEqual(new Set(['api-a.e2e.invalid']))

    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Reload' }).click()
    await reloaded

    await expectControlledByWorker(page)
    await expect(page.getByRole('heading', { level: 1, name: 'ParametriCAD' })).toBeVisible()
    await expect.poll(() => entryScript(page)).not.toBe(before)
    await expect.poll(async () => (await workerState(page)).waiting).toBeNull()
    await expect(page.getByText('A new version is available.')).toHaveCount(0)
    // The second release is the one talking now.
    expect(serviceCalls).toContain('api-b.e2e.invalid')
  })

  test('choosing Later leaves the old version running and the edit untouched', async ({ page }) => {
    test.setTimeout(60_000)
    const { diameter, before } = await deploySecondRelease(page)

    await page.getByRole('button', { name: 'Later' }).click()

    await expect(page.getByText('A new version is available.')).toHaveCount(0)
    expect(await workerState(page)).toEqual({ active: 'activated', waiting: 'installed', controllerChanges: 0 })
    expect(await entryScript(page)).toBe(before)
    await expect(diameter).toHaveValue('123')
  })
})
