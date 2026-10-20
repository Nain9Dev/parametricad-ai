import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePwaUpdate } from '@/lib/hooks/usePwaUpdate'

// @req REQ-EVT-07

const registration = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [registration.needRefresh, registration.setNeedRefresh],
    offlineReady: [registration.offlineReady, registration.setOfflineReady],
    updateServiceWorker: registration.updateServiceWorker,
  }),
}))

const reload = vi.fn()
let serviceWorker: EventTarget

beforeEach(() => {
  registration.needRefresh = false
  registration.offlineReady = false
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

  it('hands out callbacks that stay the same between renders', () => {
    const { result, rerender } = renderHook(() => usePwaUpdate())
    const first = result.current

    rerender()

    expect(result.current.applyUpdate).toBe(first.applyUpdate)
    expect(result.current.dismissUpdate).toBe(first.dismissUpdate)
    expect(result.current.dismissOfflineReady).toBe(first.dismissOfflineReady)
  })
})
