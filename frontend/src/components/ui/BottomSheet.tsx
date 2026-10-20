import { useEffect, useId, useRef, type ReactNode } from 'react'

import { CloseIcon } from '@/components/ui/Icons'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * A panel that rises from the bottom edge, for the controls a small screen has
 * no room to keep on show.
 *
 * It is a native modal `<dialog>`: the browser supplies the focus trap, the
 * Escape key, the inertness of the page behind it and the return of focus to
 * the control that opened it, none of which is worth rebuilding. `open` drives
 * the dialog; the `close` event keeps the caller's state honest when the
 * browser closes it first.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      // A press on the backdrop lands on the dialog element itself; a press on
      // anything inside lands on a descendant.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="bottom-sheet"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-1 pr-2 pl-4">
          <h2 id={titleId} className="text-sm font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:text-ink"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>
  )
}
