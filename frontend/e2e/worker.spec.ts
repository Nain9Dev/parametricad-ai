// @req REQ-UBI-10
// @req REQ-UBI-11
// @req REQ-EVT-07
import { expect, test } from './support/fixtures.ts'
import { expectControlledByWorker, openApp, PRESETS } from './support/app.ts'
import { BASE_URL } from './support/env.ts'

test.describe('REQ-UBI-10 and REQ-UBI-11: the manifest and the service worker', () => {
  test('the manifest is served as application/manifest+json and Chrome accepts it', async ({
    page,
  }) => {
    await openApp(page)

    const response = await page.request.get('/manifest.webmanifest')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/manifest+json')

    // What the browser made of the `<link rel="manifest">`, not what the file says.
    const cdp = await page.context().newCDPSession(page)
    const { url, errors, data } = await cdp.send('Page.getAppManifest')
    expect(url).toBe(`${BASE_URL}/manifest.webmanifest`)
    expect(errors, 'problems Chrome found in the manifest').toEqual([])
    const manifest = JSON.parse(data ?? '{}') as { name?: string; display?: string }
    expect(manifest.name).toBe('ParametriCAD AI')
    expect(manifest.display).toBe('standalone')
  })

  test('the worker is active and controls the page after one load', async ({ page }) => {
    await openApp(page)
    await expectControlledByWorker(page)

    const worker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return {
        scope: registration.scope,
        active: registration.active?.scriptURL,
        controller: navigator.serviceWorker.controller?.scriptURL,
      }
    })
    expect(worker).toEqual({
      scope: `${BASE_URL}/`,
      active: `${BASE_URL}/sw.js`,
      controller: `${BASE_URL}/sw.js`,
    })
  })

  test('Cache Storage holds the shell and the four presets, and nothing from another origin', async ({
    page,
  }) => {
    await openApp(page)
    await expectControlledByWorker(page)

    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url)
      }
      return urls
    })
    const paths = cached.map((url) => new URL(url).pathname)

    // Nothing at runtime: the failed service calls above left no trace in any cache.
    expect([...new Set(cached.map((url) => new URL(url).origin))]).toEqual([BASE_URL])
    expect(paths).toEqual(
      expect.arrayContaining([
        '/index.html',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/presets/catalog.json',
        ...PRESETS.flatMap((preset) => [`/presets/${preset.id}.json`, `/presets/${preset.id}.glb`]),
      ]),
    )
  })
})

test.describe('REQ-EVT-07: the user is told when the app can work offline', () => {
  test('the first load announces that it is ready to work offline', async ({ page }) => {
    await openApp(page)
    await expect(page.getByText('Ready to work offline.')).toBeVisible()
  })
})
