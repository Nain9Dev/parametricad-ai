import { useCallback, useSyncExternalStore } from 'react'

/**
 * Tracks a CSS media query.
 *
 * Built on `useSyncExternalStore` so the first render already reflects the real
 * viewport instead of flashing the wrong layout for a frame, and so the value
 * stays consistent under concurrent rendering. There is no server rendering
 * here; the `false` server snapshot only keeps the hook total.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
