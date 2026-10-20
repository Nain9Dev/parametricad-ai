import { useCallback, useEffect, useState } from 'react'

import { useMediaQuery } from '@/lib/hooks/useMediaQuery'

/** The event Chrome fires when it considers the app installable. Not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface InstallPromptController {
  /** The browser has offered installation and the app is not running installed. */
  canInstall: boolean
  /**
   * iOS never offers installation, so the user has to be told how to add the
   * app by hand: Share, then Add to Home Screen.
   */
  showIosHint: boolean
  /** Open the browser's own install prompt. */
  promptInstall: () => Promise<InstallOutcome>
}

function isIosDevice(): boolean {
  const { userAgent, maxTouchPoints } = navigator
  if (/iPhone|iPad|iPod/.test(userAgent)) return true
  // iPadOS 13 and later present themselves as a Mac; only the touch screen gives them away.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1
}

/** Safari's own flag for an app launched from the home screen. */
function isLaunchedFromHomeScreen(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Tracks whether the app can be installed, and opens the browser's prompt.
 *
 * The browser fires `beforeinstallprompt` once it has decided the app qualifies.
 * Cancelling that event keeps the browser from showing its own banner, and the
 * event is held until the user presses the Install control. A prompt event can
 * be used once, so it is dropped as soon as the user has answered.
 */
export function useInstallPrompt(): InstallPromptController {
  const [offer, setOffer] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const standalone = useMediaQuery('(display-mode: standalone)')

  useEffect(() => {
    const onOffer = (event: Event) => {
      event.preventDefault()
      setOffer(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setOffer(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onOffer)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onOffer)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!offer) return 'unavailable'
    await offer.prompt()
    const { outcome } = await offer.userChoice
    setOffer(null)
    return outcome
  }, [offer])

  const running = standalone || installed || isLaunchedFromHomeScreen()

  return {
    canInstall: !running && offer !== null,
    showIosHint: !running && isIosDevice(),
    promptInstall,
  }
}
