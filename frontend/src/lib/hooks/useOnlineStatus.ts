import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * Whether the device reports a network connection.
 *
 * `false` is reliable: there is no network at all. `true` only means a network
 * interface is up, and a request can still fail on it, so failures are also
 * reported where they happen (see `unreachableError` in `@/lib/apiClient`).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
