import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt'
import { restoreMatchMedia, stubMatchMedia } from '@/test/media'

// @req REQ-EVT-06

const STANDALONE = '(display-mode: standalone)'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'

type Outcome = 'accepted' | 'dismissed'

/** The event Chrome fires when the app can be installed. */
function installEvent(outcome: Outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  const prompt = vi.fn(() => Promise.resolve())
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome, platform: 'web' }) })
  return { event, prompt }
}

function fire(event: Event) {
  act(() => {
    window.dispatchEvent(event)
  })
}

function reportDevice(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  })
}

afterEach(() => {
  restoreMatchMedia()
  Reflect.deleteProperty(window.navigator, 'userAgent')
  Reflect.deleteProperty(window.navigator, 'maxTouchPoints')
  Reflect.deleteProperty(window.navigator, 'standalone')
})

describe('useInstallPrompt on a browser that offers installation', () => {
  it('cannot install until the browser says so', () => {
    stubMatchMedia()
    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.canInstall).toBe(false)
    expect(result.current.showIosHint).toBe(false)
  })

  it('can install once the browser fires its event, and keeps the event for later', () => {
    stubMatchMedia()
    const { result } = renderHook(() => useInstallPrompt())
    const { event } = installEvent()

    fire(event)

    expect(result.current.canInstall).toBe(true)
    // Without this the browser shows its own mini-infobar instead of waiting for us.
    expect(event.defaultPrevented).toBe(true)
  })

  it.each(['accepted', 'dismissed'] as const)(
    'opens the prompt once and hides the control when the user %s it',
    async (outcome) => {
      stubMatchMedia()
      const { result } = renderHook(() => useInstallPrompt())
      const { event, prompt } = installEvent(outcome)
      fire(event)

      let answer: string | undefined
      await act(async () => {
        answer = await result.current.promptInstall()
      })

      expect(answer).toBe(outcome)
      expect(prompt).toHaveBeenCalledTimes(1)
      // The event can be used once; asking again would throw.
      expect(result.current.canInstall).toBe(false)
    },
  )

  it('has nothing to open before the browser has offered installation', async () => {
    stubMatchMedia()
    const { result } = renderHook(() => useInstallPrompt())

    let answer: string | undefined
    await act(async () => {
      answer = await result.current.promptInstall()
    })

    expect(answer).toBe('unavailable')
  })

  it('hides the control once the app has been installed', () => {
    stubMatchMedia()
    const { result } = renderHook(() => useInstallPrompt())
    fire(installEvent().event)
    expect(result.current.canInstall).toBe(true)

    fire(new Event('appinstalled'))

    expect(result.current.canInstall).toBe(false)
  })

  it('offers nothing when the app is already running installed', () => {
    stubMatchMedia([STANDALONE])
    const { result } = renderHook(() => useInstallPrompt())

    fire(installEvent().event)

    expect(result.current.canInstall).toBe(false)
    expect(result.current.showIosHint).toBe(false)
  })

  it('stops listening when the component unmounts', () => {
    stubMatchMedia()
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useInstallPrompt())

    unmount()

    expect(remove).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('appinstalled', expect.any(Function))
    remove.mockRestore()
  })
})

describe('useInstallPrompt on iOS, which never fires the event', () => {
  it('explains Add to Home Screen on an iPhone', () => {
    stubMatchMedia()
    reportDevice(IPHONE, 5)
    const { result } = renderHook(() => useInstallPrompt())

    expect(result.current.showIosHint).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('recognises an iPad that presents itself as a Mac', () => {
    stubMatchMedia()
    reportDevice(MAC_UA, 5)
    expect(renderHook(() => useInstallPrompt()).result.current.showIosHint).toBe(true)
  })

  it('does not mistake a real Mac or an Android phone for iOS', () => {
    stubMatchMedia()
    reportDevice(MAC_UA, 0)
    expect(renderHook(() => useInstallPrompt()).result.current.showIosHint).toBe(false)

    reportDevice(ANDROID, 5)
    expect(renderHook(() => useInstallPrompt()).result.current.showIosHint).toBe(false)
  })

  it('stops explaining once the app runs from the home screen', () => {
    stubMatchMedia([STANDALONE])
    reportDevice(IPHONE, 5)
    expect(renderHook(() => useInstallPrompt()).result.current.showIosHint).toBe(false)
  })

  it('also reads the older Safari flag for a home-screen launch', () => {
    stubMatchMedia()
    reportDevice(IPHONE, 5)
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true })
    expect(renderHook(() => useInstallPrompt()).result.current.showIosHint).toBe(false)
  })
})
