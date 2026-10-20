import { useEffect } from 'react'

import { Button } from '@/components/ui/Button'
import { CheckIcon, CloseIcon } from '@/components/ui/Icons'
import { usePwaUpdate } from '@/lib/hooks/usePwaUpdate'

/** How long the good news stays on screen before it goes by itself. */
const OFFLINE_READY_MS = 6_000

/**
 * What the service worker has to tell the user.
 *
 * A waiting version is announced and applied only when the user chooses Reload,
 * so a reload never discards an edit in progress. It stays until answered. The
 * "ready offline" notice is news, not a decision, and leaves on its own.
 */
export function PwaStatus() {
  const { updateReady, offlineReady, applyUpdate, dismissUpdate, dismissOfflineReady } =
    usePwaUpdate()

  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(dismissOfflineReady, OFFLINE_READY_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, dismissOfflineReady])

  return (
    // The live region is always in the page, so a message added later is announced.
    <div
      role="status"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
    >
      {updateReady ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-accent/40 bg-surface/95 py-2 pr-2 pl-3 shadow-lg backdrop-blur">
          <p className="flex-1 text-sm text-ink">A new version is available.</p>
          <Button size="sm" variant="primary" onClick={applyUpdate}>
            Reload
          </Button>
          <Button size="sm" variant="ghost" onClick={dismissUpdate}>
            Later
          </Button>
        </div>
      ) : null}

      {offlineReady ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-valid/35 bg-surface/95 py-1 pr-1 pl-3 shadow-lg backdrop-blur">
          <CheckIcon className="size-4 shrink-0 text-valid" />
          <p className="flex-1 text-sm text-ink">Ready to work offline.</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissOfflineReady}
            className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </div>
  )
}
