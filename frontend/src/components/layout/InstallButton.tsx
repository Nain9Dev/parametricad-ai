import { useState } from 'react'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { DownloadIcon } from '@/components/ui/Icons'

interface InstallButtonProps {
  /** The browser has offered installation. */
  canInstall: boolean
  /** iOS offers nothing, so the control explains Add to Home Screen instead. */
  showIosHint: boolean
  onInstall: () => void
}

/**
 * The Install control in the header.
 *
 * With the browser's offer in hand it opens the browser's own prompt. On iOS,
 * where there is no prompt to open, it opens a short explanation. It renders
 * nothing when there is neither, so an installed app or an unsupported browser
 * never shows a button that cannot work.
 */
export function InstallButton({ canInstall, showIosHint, onInstall }: InstallButtonProps) {
  const [hintOpen, setHintOpen] = useState(false)

  if (!canInstall && !showIosHint) return null

  return (
    <>
      <button
        type="button"
        aria-label="Install app"
        aria-haspopup={canInstall ? undefined : 'dialog'}
        onClick={canInstall ? onInstall : () => setHintOpen(true)}
        // Icon alone below 640 px, where the header has no room for the word.
        className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-accent/40 bg-accent/12 px-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 sm:h-7 sm:text-[0.6875rem] pointer-coarse:h-11"
      >
        <DownloadIcon className="size-4 sm:size-3" />
        <span className="hidden sm:inline">Install</span>
      </button>

      {canInstall ? null : (
        <BottomSheet
          open={hintOpen}
          onClose={() => setHintOpen(false)}
          title="Install ParametriCAD"
        >
          <div className="space-y-3 p-4 text-sm text-ink-muted">
            <p>Add it to your home screen to open it like an app.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Tap the <strong className="font-semibold text-ink">Share</strong> button in the
                browser toolbar.
              </li>
              <li>
                Choose <strong className="font-semibold text-ink">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="font-semibold text-ink">Add</strong>.
              </li>
            </ol>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
