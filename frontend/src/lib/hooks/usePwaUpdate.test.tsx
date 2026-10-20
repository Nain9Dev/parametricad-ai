import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => {
  registration.needRefresh = false
  registration.offlineReady = false
  registration.setNeedRefresh.mockClear()
  registration.setOfflineReady.mockClear()
  registration.updateServiceWorker.mockClear()
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

  it('hands out callbacks that stay the same between renders', () => {
    const { result, rerender } = renderHook(() => usePwaUpdate())
    const first = result.current

    rerender()

    expect(result.current.applyUpdate).toBe(first.applyUpdate)
    expect(result.current.dismissUpdate).toBe(first.dismissUpdate)
    expect(result.current.dismissOfflineReady).toBe(first.dismissOfflineReady)
  })
})
