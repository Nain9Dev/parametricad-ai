// @req REQ-EVT-07
import type { BrowserContext, Page } from '@playwright/test'

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

/** Everything the page can see of the worker: who controls it, runs, installs or waits, and whether control moved. */
function describeWorker(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    const watched = (window as Window & { __controllerChanges?: { count: number } }).__controllerChanges
    return {
      controller: navigator.serviceWorker.controller?.state ?? null,
      installing: registration?.installing?.state ?? null,
      waiting: registration?.waiting?.state ?? null,
      active: registration?.active?.state ?? null,
      controllerChanges: watched?.count ?? null,
    }
  })
}

/** What the browser knows about the worker: who runs, who waits, and whether control moved. */
async function workerState(page: Page) {
  const { active, waiting, controllerChanges } = await describeWorker(page)
  return { active, waiting, controllerChanges }
}

/** How long Reload may take to load the page again; each test allows a minute in all. */
const RELOAD_MS = 30_000

/**
 * Press Reload on the banner and wait for the page to load again. When it does not,
 * the failure says what the worker was doing: an update that never took over and one
 * that took over without reloading the page are different defects (ADR-0009 records
 * a Reload that did not reload, seen twice and not yet explained).
 */
async function pressReload(page: Page): Promise<void> {
  try {
    await Promise.all([
      page.waitForEvent('load', { timeout: RELOAD_MS }),
      page.getByRole('button', { name: 'Reload' }).click(),
    ])
  } catch (error) {
    const worker = await describeWorker(page).catch(() => 'unavailable')
    throw new Error(`Reload did not load the page again. Worker: ${JSON.stringify(worker)}`, { cause: error })
  }
}

/**
 * The hosts of the generation service that the page talks to, as the page asks for
 * them. The fixtures abort every request to these hosts, which never resolve.
 */
function watchServiceCalls(page: Page): string[] {
  const calls: string[] = []
  page.on('request', (request) => {
    const { host } = new URL(request.url())
    if (host.endsWith('.e2e.invalid')) calls.push(host)
  })
  return calls
}

/**
 * Remember, in every document the page loads, whether a worker controlled it when it
 * started. That is what tells a returning visit from a first one.
 */
function markControlledAtStart(page: Page) {
  return page.addInitScript(() => {
    Object.assign(window, { __controlledAtStart: Boolean(navigator.serviceWorker?.controller) })
  })
}

function wasControlledAtStart(page: Page) {
  return page.evaluate(() => (window as Window & { __controlledAtStart?: boolean }).__controlledAtStart)
}

/** Count the changes of controller this document sees; a reload starts the count again. */
function watchControllerChanges(page: Page) {
  return page.evaluate(() => {
    const watched = { count: 0 }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      watched.count += 1
    })
    Object.assign(window, { __controllerChanges: watched })
  })
}

/**
 * How the tab came to run the first release. After a reload the page starts under
 * the worker, as a returning visitor's does. A tab that stays open from the first
 * visit never did: no worker controlled it when it started, and the library
 * behind the update prompt does not count such a page as one that can be updated.
 */
const VISITS = [
  { kind: 'returning', description: 'a returning visit, which started under the worker' },
  { kind: 'first', description: 'a first visit, which started before any worker and is never reloaded' },
] as const

type Visit = (typeof VISITS)[number]['kind']

test.describe('REQ-EVT-07: a new version is announced and applied only when the user accepts', () => {
  // Whatever a test leaves served, the next one starts from the first release.
  test.afterEach(() => serveBundle('a'))

  /** Open the first release, start an edit, deploy the second and wait for the banner. */
  async function deploySecondRelease(page: Page, visit: Visit = 'returning') {
    const serviceCalls = watchServiceCalls(page)
    await markControlledAtStart(page)

    await openApp(page)
    await expectControlledByWorker(page)
    if (visit === 'returning') {
      // The page now starts under the worker, as it does for anyone who has
      // opened the app before and sees a release arrive.
      await page.reload()
      await expectModelReady(page)
      await expectControlledByWorker(page)
    }
    expect(await wasControlledAtStart(page), 'whether a worker controlled the page when it started').toBe(
      visit === 'returning',
    )

    // An edit in progress, which a reload would lose. Live regeneration is off
    // so the edit makes no request of its own.
    await page.getByLabel('Regenerate as I edit').uncheck()
    const diameter = page.getByLabel('Outer diameter', { exact: true })
    await diameter.fill('123')

    await watchControllerChanges(page)
    const before = await entryScript(page)

    // Nothing to offer yet. On a first visit the worker has just taken the page over,
    // and that is the install, not a new version.
    await expect(page.getByText('A new version is available.')).toHaveCount(0)

    serveBundle('b')
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update()
    })
    await expect(page.getByText('A new version is available.')).toBeVisible()

    return { diameter, before, serviceCalls }
  }

  for (const { kind, description } of VISITS) {
    test(`the old version keeps running until Reload is pressed, then the new one takes over: ${description}`, async ({
      page,
    }) => {
      test.setTimeout(60_000)
      const { diameter, before, serviceCalls } = await deploySecondRelease(page, kind)

      // Announced, not applied: the new worker waits, nothing was taken over, the
      // page is the one it was, and the edit is still there.
      expect(await workerState(page)).toEqual({ active: 'activated', waiting: 'installed', controllerChanges: 0 })
      expect(await entryScript(page)).toBe(before)
      await expect(diameter).toHaveValue('123')
      expect(new Set(serviceCalls)).toEqual(new Set(['api-a.e2e.invalid']))

      await pressReload(page)

      await expectControlledByWorker(page)
      await expect(page.getByRole('heading', { level: 1, name: 'ParametriCAD' })).toBeVisible()
      await expect.poll(() => entryScript(page)).not.toBe(before)
      await expect.poll(async () => (await workerState(page)).waiting).toBeNull()
      await expect(page.getByText('A new version is available.')).toHaveCount(0)
      // The second release is the one talking now.
      expect(serviceCalls).toContain('api-b.e2e.invalid')
    })
  }

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

/** Long enough for a reload that nobody asked for to start; a tab left alone does nothing in it. */
const QUIET_MS = 2_000

/**
 * One browser, one worker, two tabs: whatever the worker does reaches both. Accepting
 * is the decision of the user of one tab, so it must not decide for the user of the other.
 */
test.describe('REQ-EVT-07 across tabs: only the tab whose user accepts is reloaded', () => {
  test.afterEach(() => serveBundle('a'))

  /**
   * Open the first release in two tabs that both start under the worker, start an edit
   * in the second, deploy the second release and wait until both tabs offer it. `page`
   * is the tab whose user will accept; `other` is the tab that must be left alone.
   */
  async function deployWithTwoTabs(page: Page, context: BrowserContext) {
    await markControlledAtStart(page)
    await openApp(page)
    await expectControlledByWorker(page)
    // The first tab now starts under the worker, as the second does from the outset.
    await page.reload()
    await expectModelReady(page)
    await expectControlledByWorker(page)

    const other = await context.newPage()
    const otherErrors: string[] = []
    other.on('pageerror', (error) => otherErrors.push(error.message))
    const otherServiceCalls = watchServiceCalls(other)
    await markControlledAtStart(other)
    await openApp(other)
    await expectControlledByWorker(other)
    for (const tab of [page, other]) {
      expect(await wasControlledAtStart(tab), 'whether a worker controlled the tab when it started').toBe(true)
    }

    // An edit in progress in the tab that will not accept. Live regeneration is off
    // so the edit makes no request of its own.
    await other.getByLabel('Regenerate as I edit').uncheck()
    const otherDiameter = other.getByLabel('Outer diameter', { exact: true })
    await otherDiameter.fill('123')

    await watchControllerChanges(page)
    await watchControllerChanges(other)
    const pageBefore = await entryScript(page)
    const otherBefore = await entryScript(other)
    // Playwright keeps this count across reloads of the tab, which the page cannot.
    const otherLoads = { count: 0 }
    other.on('load', () => {
      otherLoads.count += 1
    })

    serveBundle('b')
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update()
    })
    await expect(page.getByText('A new version is available.')).toBeVisible()
    await expect(other.getByText('A new version is available.')).toBeVisible()

    return { other, otherDiameter, otherBefore, otherLoads, otherErrors, otherServiceCalls, pageBefore }
  }

  test('accepting in one tab leaves the other tab, and the edit in it, alone', async ({ page, context }) => {
    test.setTimeout(60_000)
    const { other, otherDiameter, otherBefore, otherLoads, otherErrors, pageBefore } = await deployWithTwoTabs(
      page,
      context,
    )

    await pressReload(page)

    // The tab that accepted runs the new release.
    await expectControlledByWorker(page)
    await expect.poll(() => entryScript(page)).not.toBe(pageBefore)

    // The new worker took over every tab at once. Give a reload that nobody asked for
    // the time to start, then look at the tab that did not accept.
    await other.waitForTimeout(QUIET_MS)
    expect(otherLoads.count, 'the other tab was reloaded although its user did not accept').toBe(0)
    expect(await entryScript(other)).toBe(otherBefore)
    await expect(otherDiameter).toHaveValue('123')
    expect(await workerState(other)).toEqual({ active: 'activated', waiting: null, controllerChanges: 1 })
    expect(otherErrors, 'uncaught errors in the other tab').toEqual([])
  })

  test('the other tab can then reload itself onto the new version', async ({ page, context }) => {
    test.setTimeout(60_000)
    const { other, otherBefore, otherLoads, otherErrors, otherServiceCalls } = await deployWithTwoTabs(page, context)

    await pressReload(page)
    await expectControlledByWorker(page)

    // Not reloaded, and still offering the version that the first tab has applied.
    await expect(other.getByText('A new version is available.')).toBeVisible()
    expect(otherLoads.count, 'the other tab was reloaded although its user did not accept').toBe(0)

    // No version waits any more, so this Reload has no change of control to wait for.
    await pressReload(other)

    await expectControlledByWorker(other)
    await expect(other.getByRole('heading', { level: 1, name: 'ParametriCAD' })).toBeVisible()
    await expect.poll(() => entryScript(other)).not.toBe(otherBefore)
    await expect(other.getByText('A new version is available.')).toHaveCount(0)
    // The second release is the one talking now.
    expect(otherServiceCalls).toContain('api-b.e2e.invalid')
    expect(otherErrors, 'uncaught errors in the other tab').toEqual([])
  })

  test('a tab that put the update off is offered the version again when another tab applies it', async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000)
    const { other, otherDiameter, otherLoads, otherErrors } = await deployWithTwoTabs(page, context)

    await other.getByRole('button', { name: 'Later' }).click()
    await expect(other.getByText('A new version is available.')).toHaveCount(0)

    await pressReload(page)
    await expectControlledByWorker(page)

    // The new version is in charge underneath the other tab, whose user said Later.
    // It is told so, and nothing else happens to it.
    await expect(other.getByText('A new version is available.')).toBeVisible()
    expect(otherLoads.count, 'the other tab was reloaded although its user did not accept').toBe(0)
    await expect(otherDiameter).toHaveValue('123')
    expect(otherErrors, 'uncaught errors in the other tab').toEqual([])
  })
})
