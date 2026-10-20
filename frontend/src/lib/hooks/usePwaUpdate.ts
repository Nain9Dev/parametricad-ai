import { useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export interface PwaUpdateController {
  /** A new version has been downloaded and is waiting. */
  updateReady: boolean
  /** The shell and the presets have just been cached for the first time. */
  offlineReady: boolean
  /** Apply the waiting version; the page reloads once the new worker takes over. */
  applyUpdate: () => void
  /** Put the update off. It applies by itself the next time the app is opened. */
  dismissUpdate: () => void
  dismissOfflineReady: () => void
}

/**
 * Reload the page. Always the same function, so listening with it twice (Reload
 * chosen twice) still reloads once.
 */
function reloadPage(): void {
  window.location.reload()
}

/**
 * Registers the service worker and reports its life cycle (ADR-0007).
 *
 * A new version waits until `applyUpdate` is called: reloading on its own would
 * throw away whatever the user is in the middle of editing (REQ-EVT-07). The
 * registration comes from the PWA plugin's generated module, which does nothing
 * under the development server.
 */
export function usePwaUpdate(): PwaUpdateController {
  const {
    needRefresh: [updateReady, setUpdateReady],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  const applyUpdate = useCallback(() => {
    // The plugin reloads only a page that a worker already controlled when it
    // registered (workbox-window `isUpdate`). A tab opened before any worker
    // existed would take the new worker and keep running the old code, whose lazy
    // chunks may be gone. The user has accepted, so reload once control changes,
    // whatever the plugin counts. Where it reloads too, the second request
    // replaces the first and the page still loads once.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', reloadPage, { once: true })
    }
    void updateServiceWorker(true)
  }, [updateServiceWorker])
  const dismissUpdate = useCallback(() => setUpdateReady(false), [setUpdateReady])
  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady])

  return { updateReady, offlineReady, applyUpdate, dismissUpdate, dismissOfflineReady }
}
