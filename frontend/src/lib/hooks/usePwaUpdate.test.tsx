import { renderHook } from '@testing-library/react'
import type { RegisterSWOptions } from 'virtual:pwa-register/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePwaUpdate } from '@/lib/hooks/usePwaUpdate'

// @req REQ-EVT-07

const registration = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
  /** What the hook handed the plugin, which acts on it from then on. */
  options: undefined as RegisterSWOptions | undefined,
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: RegisterSWOptions) => {
    registration.options = options
    return {
      needRefresh: [registration.needRefresh, registration.setNeedRefresh],
      offlineReady: [registration.offlineReady, registration.setOfflineReady],
      updateServiceWorker: registration.updateServiceWorker,
    }
  },
}))

const reload = vi.fn()
let serviceWorker: EventTarget

/** The plugin reports the page's registration once it has registered. */
function register(waiting: ServiceWorker | null): void {
  registration.options?.onRegisteredSW?.('/sw.js', { waiting } as ServiceWorkerRegistration)
}

beforeEach(() => {
  registration.needRefresh = false
  registration.offlineReady = false
  registration.options = undefined
  registration.setNeedRefresh.mockClear()
  registration.setOfflineReady.mockClear()
  registration.updateServiceWorker.mockClear()

  // jsdom has no service worker container and no page that can navigate. These
  // stand-ins let a test play the browser's part: announce a change of control,
  // and see whether the page was asked to reload.
  serviceWorker = new EventTarget()
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker })
  reload.mockClear()
  vi.stubGlobal('location', { ...window.location, reload })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
})

describe('usePwaUpdate', () => {
  it('reports a waiting version and a ready cache from the registration', () => {
    registration.needRefresh = true
    registration.offlineReady = true

    const { result } = renderHook(() => usePwaUpdate())

    expect(result.current.updateReady).toBe(true)
    expect(result.current.offlineReady).toBe(true)
  })

  it('applies the waiting version only when asked', () => {
    const { result } = renderHook(() => usePwaUpdate())
    expect(registration.updateServiceWorker).not.toHaveBeenCalled()

    result.current.applyUpdate()

    expect(registration.updateServiceWorker).toHaveBeenCalledTimes(1)
    expect(registration.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('lets the user put the update off without losing it', () => {
    const { result } = renderHook(() => usePwaUpdate())

    result.current.dismissUpdate()

    expect(registration.setNeedRefresh).toHaveBeenCalledWith(false)
    expect(registration.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('dismisses the ready-offline notice', () => {
    const { result } = renderHook(() => usePwaUpdate())

    result.current.dismissOfflineReady()

    expect(registration.setOfflineReady).toHaveBeenCalledWith(false)
  })

  // The PWA plugin reloads only a page that a worker already controlled when the
  // page registered its own (workbox-window `isUpdate`). A tab opened before any
  // worker existed gets the new worker and keeps the old code, so the hook has to
  // reload for itself once the user has accepted.
  it('reloads the page when the new worker takes control after the user accepts', () => {
    const { result } = renderHook(() => usePwaUpdate())

    result.current.applyUpdate()
    serviceWorker.dispatchEvent(new Event('controllerchange'))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once however many times the user chooses Reload', () => {
    const { result } = renderHook(() => usePwaUpdate())

    result.current.applyUpdate()
    result.current.applyUpdate()
    serviceWorker.dispatchEvent(new Event('controllerchange'))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload for a change of control the user has not accepted', () => {
    // The first worker claiming the page on a first visit is such a change.
    renderHook(() => usePwaUpdate())

    serviceWorker.dispatchEvent(new Event('controllerchange'))

    expect(reload).not.toHaveBeenCalled()
  })

  it('does not reload when the user puts the update off', () => {
    const { result } = renderHook(() => usePwaUpdate())

    result.current.dismissUpdate()
    serviceWorker.dispatchEvent(new Event('controllerchange'))

    expect(reload).not.toHaveBeenCalled()
  })

  it('still applies the update where the browser has no service worker container', () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    const { result } = renderHook(() => usePwaUpdate())

    expect(() => result.current.applyUpdate()).not.toThrow()

    expect(registration.updateServiceWorker).toHaveBeenCalledTimes(1)
  })

  // Several tabs share one worker. Every tab that has seen the waiting version asks
  // the plugin to reload it as soon as control changes, whichever tab accepted
  // (workbox-window `controlling` with `isUpdate`), and the plugin does so with the
  // function it was handed, or with `location.reload` when it was handed none.
  it('hands the plugin a reload that does nothing, so a tab whose user did not accept is never reloaded', () => {
    renderHook(() => usePwaUpdate())

    expect(registration.options?.onNeedReload).toBeTypeOf('function')
    registration.options?.onNeedReload?.()

    expect(reload).not.toHaveBeenCalled()
  })

  it('waits for the change of control while a version is still waiting', () => {
    const { result } = renderHook(() => usePwaUpdate())
    register({} as ServiceWorker)

    result.current.applyUpdate()
    expect(registration.updateServiceWorker).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()

    serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // Another tab accepted first: the new worker is in charge here too, no version
  // waits any more, and no further change of control is coming to reload for.
  it('reloads at once when the user accepts after another tab has applied the version', () => {
    const { result } = renderHook(() => usePwaUpdate())
    register(null)

    result.current.applyUpdate()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  // A tab that was left behind runs old code under the new worker, whether it was
  // ever asked, or chose Later. It is told, and left as it is until its user decides.
  it('offers the version again when another tab puts it in charge', () => {
    Object.assign(serviceWorker, { controller: {} })
    renderHook(() => usePwaUpdate())

    serviceWorker.dispatchEvent(new Event('controllerchange'))

    expect(registration.setNeedRefresh).toHaveBeenCalledWith(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not take the first worker of a first visit for a new version', () => {
    // No worker controls the page yet, so the first one to claim it is the install.
    renderHook(() => usePwaUpdate())

    serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(registration.setNeedRefresh).not.toHaveBeenCalled()

    // The next change of control is a new version.
    serviceWorker.dispatchEvent(new Event('controllerchange'))
    expect(registration.setNeedRefresh).toHaveBeenCalledWith(true)
  })

  it('stops listening for changes of control when the page goes away', () => {
    Object.assign(serviceWorker, { controller: {} })
    const { unmount } = renderHook(() => usePwaUpdate())

    unmount()
    serviceWorker.dispatchEvent(new Event('controllerchange'))

    expect(registration.setNeedRefresh).not.toHaveBeenCalled()
  })

  it('hands out callbacks that stay the same between renders', () => {
    const { result, rerender } = renderHook(() => usePwaUpdate())
    const first = result.current

    rerender()

    expect(result.current.applyUpdate).toBe(first.applyUpdate)
    expect(result.current.dismissUpdate).toBe(first.dismissUpdate)
    expect(result.current.dismissOfflineReady).toBe(first.dismissOfflineReady)
  })
})
