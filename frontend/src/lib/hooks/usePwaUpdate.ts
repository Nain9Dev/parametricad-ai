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
    void updateServiceWorker(true)
  }, [updateServiceWorker])
  const dismissUpdate = useCallback(() => setUpdateReady(false), [setUpdateReady])
  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady])

  return { updateReady, offlineReady, applyUpdate, dismissUpdate, dismissOfflineReady }
}
