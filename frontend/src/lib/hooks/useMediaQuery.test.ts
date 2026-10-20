import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from '@/lib/hooks/useMediaQuery'

// @req REQ-UBI-12

type Listener = () => void

/** A controllable stand-in for `window.matchMedia`, which jsdom does not implement. */
function installMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<Listener>()
  const queryList = {
    get matches() {
      return matches
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => queryList),
  })
  return {
    listeners,
    change(next: boolean) {
      matches = next
      listeners.forEach((listener) => listener())
    },
  }
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('useMediaQuery', () => {
  it('reports the current match on the first render', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(max-width: 63.9375rem)'))
    expect(result.current).toBe(true)
  })

  it('follows the query when the viewport crosses the breakpoint', () => {
    const media = installMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 63.9375rem)'))
    expect(result.current).toBe(false)

    act(() => media.change(true))
    expect(result.current).toBe(true)

    act(() => media.change(false))
    expect(result.current).toBe(false)
  })

  it('stops listening when the component unmounts', () => {
    const media = installMatchMedia(false)
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 63.9375rem)'))
    expect(media.listeners.size).toBe(1)

    unmount()
    expect(media.listeners.size).toBe(0)
  })
})
