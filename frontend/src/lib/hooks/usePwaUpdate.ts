import { useCallback, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export interface PwaUpdateController {
  /** A new version has been downloaded and is waiting, or another tab has put it in charge. */
  updateReady: boolean
  /** The shell and the presets have just been cached for the first time. */
  offlineReady: boolean
  /** Apply the new version; the page reloads once the new worker takes over. */
  applyUpdate: () => void
  /**
   * Put the update off. It applies by itself the next time the app is opened, and is
   * offered again if another tab applies it first.
   */
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
 * What the PWA plugin runs in place of reloading. It runs it in every tab that has
 * seen a waiting version, as soon as control changes, whichever tab accepted
 * (workbox-window `controlling` with `isUpdate`). Left to itself it would reload
 * tabs whose users have accepted nothing.
 */
function keepPage(): void {
  // Nothing: reloading belongs to the tab whose user accepted (`applyUpdate`).
}

/**
 * Registers the service worker and reports its life cycle (ADR-0007, ADR-0010).
 *
 * A new version waits until `applyUpdate` is called: reloading on its own would
 * throw away whatever the user is in the middle of editing (REQ-EVT-07). Every tab
 * of the browser shares the one worker, so this holds across tabs: accepting in one
 * reloads that tab only. The registration comes from the PWA plugin's generated
 * module, which does nothing under the development server.
 */
export function usePwaUpdate(): PwaUpdateController {
  // The page's registration, which tells whether a version still waits. The plugin
  // hands it over once, after registering.
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [updateReady, setUpdateReady],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: keepPage,
    onRegisteredSW: (_scriptUrl, registered) => {
      registration.current = registered
    },
  })

  // Another tab can put a new worker in charge of this page without this tab's user
  // having a say, and the page then runs old code under it. Say so, whether the user
  // was ever asked or chose Later; the page itself is left alone.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const container = navigator.serviceWorker
    // The first worker to take over a page that had none is the install, not news.
    let controlled = Boolean(container.controller)
    const onControllerChange = () => {
      if (controlled) setUpdateReady(true)
      controlled = true
    }
    container.addEventListener('controllerchange', onControllerChange)
    return () => container.removeEventListener('controllerchange', onControllerChange)
  }, [setUpdateReady])

  const applyUpdate = useCallback(() => {
    // Another tab applied the version first: none waits any more, so no change of
    // control is coming to reload for. This page only has to start over.
    if (registration.current && !registration.current.waiting) {
      reloadPage()
      return
    }
    // The plugin reloads nothing (`keepPage`), so reloading is done here, and only
    // now that the user has accepted: once the new worker takes control. That holds
    // for a tab opened before any worker existed too, which the plugin would never
    // reload.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', reloadPage, { once: true })
    }
    void updateServiceWorker(true)
  }, [updateServiceWorker])
  const dismissUpdate = useCallback(() => setUpdateReady(false), [setUpdateReady])
  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady])

  return { updateReady, offlineReady, applyUpdate, dismissUpdate, dismissOfflineReady }
}
