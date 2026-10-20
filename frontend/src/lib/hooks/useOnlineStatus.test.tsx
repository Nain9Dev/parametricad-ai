import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'

// @req REQ-STA-04

function reportConnection(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
}

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'onLine')
  vi.restoreAllMocks()
})

describe('useOnlineStatus', () => {
  it('starts from what the device reports', () => {
    reportConnection(false)
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(false)

    reportConnection(true)
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(true)
  })

  it('follows the offline and online events', () => {
    reportConnection(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      reportConnection(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      reportConnection(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('stops listening when the component unmounts', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useOnlineStatus())

    unmount()

    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
