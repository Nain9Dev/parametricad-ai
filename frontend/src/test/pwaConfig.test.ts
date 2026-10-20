import { describe, expect, it } from 'vitest'

import { pwaOptions } from '../../pwa.config'

// @req REQ-UBI-11
// @req REQ-EVT-07

// The service worker itself is generated at build time and cannot run under
// jsdom, so the contract is pinned on the options that produce it. What the
// built worker really lists is checked by `npm run verify:pwa` after a build.

const workbox = pwaOptions.workbox ?? {}

describe('REQ-UBI-11: the service worker caches the shell and the presets, nothing else', () => {
  it('precaches the build output and the bundled presets', () => {
    expect(workbox.globPatterns).toContain('**/*.{js,css,html,svg,png,webmanifest}')
    expect(workbox.globPatterns).toContain('presets/*.{json,glb}')
  })

  it('leaves out the link-preview image, which no installed client needs', () => {
    expect(workbox.globIgnores).toContain('og-image.png')
  })

  it('registers no runtime caching, so no API response or artifact is ever stored', () => {
    expect(workbox.runtimeCaching).toEqual([])
  })

  it('falls back to the shell for navigations, but never for the API or its artifacts', () => {
    expect(workbox.navigateFallback).toBe('/index.html')

    const denied = (path: string) =>
      (workbox.navigateFallbackDenylist ?? []).some((pattern) => pattern.test(path))
    expect(denied('/api/v1/models')).toBe(true)
    expect(denied('/static/models/abc.glb')).toBe(true)
    expect(denied('/health')).toBe(true)
    expect(denied('/')).toBe(false)
  })

  it('removes the caches of earlier releases', () => {
    expect(workbox.cleanupOutdatedCaches).toBe(true)
  })

  it('takes the manifest from the static file and registers from the app, not the plugin', () => {
    expect(pwaOptions.manifest).toBe(false)
    expect(pwaOptions.injectRegister).toBe(false)
  })

  it('stays out of the way of the development server', () => {
    expect(pwaOptions.devOptions?.enabled).toBe(false)
  })

  it('is not the self-destroying kill switch', () => {
    expect(pwaOptions.selfDestroying).toBe(false)
  })
})

describe('REQ-EVT-07: an update waits for the user', () => {
  it('asks before applying a new version', () => {
    expect(pwaOptions.registerType).toBe('prompt')
  })

  it('does not skip the waiting phase on its own', () => {
    expect(workbox.skipWaiting).not.toBe(true)
  })
})
