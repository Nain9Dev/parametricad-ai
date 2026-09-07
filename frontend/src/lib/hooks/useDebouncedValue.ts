import { useEffect, useState } from 'react'

/**
 * Track `value`, but only after it has held still for `delayMs`.
 *
 * Dragging a slider produces a value on every frame; generating a solid for
 * each of them would queue dozens of kernel jobs to display one result. The
 * first value passes through immediately so the initial render is not delayed.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState<T>(value)

  useEffect(() => {
    if (Object.is(settled, value)) return undefined
    const timer = window.setTimeout(() => setSettled(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs, settled])

  return settled
}
