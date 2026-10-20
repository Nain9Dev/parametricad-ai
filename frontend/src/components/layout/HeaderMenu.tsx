import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { MoreIcon } from '@/components/ui/Icons'
import { readProjectFile } from '@/lib/projectFile'
import type { ComponentSpec } from '@/types/api'

interface HeaderMenuProps {
  hasModel: boolean
  onExportProject?: (() => void) | undefined
  onImportProject?: ((spec: ComponentSpec) => void) | undefined
  className?: string
}

/**
 * The project actions for a header with no room for two labelled buttons.
 *
 * A menu button in the WAI-ARIA sense: focus moves to the first usable item
 * when it opens, the arrow keys cycle through the items, Escape closes it and
 * returns focus to the trigger, and a press anywhere else dismisses it. The
 * file input stays mounted outside the popup, because closing the menu on
 * selection would otherwise remove the input before the browser reports the
 * file that was picked.
 */
export function HeaderMenu({
  hasModel,
  onExportProject,
  onImportProject,
  className = '',
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    items.current.find((item) => item && !item.disabled)?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

    event.preventDefault()
    const usable = items.current.filter(
      (item): item is HTMLButtonElement => item !== null && !item.disabled,
    )
    if (usable.length === 0) return
    const index = usable.findIndex((item) => item === document.activeElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    usable[(index + step + usable.length) % usable.length]?.focus()
  }

  function save() {
    setOpen(false)
    onExportProject?.()
  }

  function chooseFile() {
    setOpen(false)
    fileInput.current?.click()
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        aria-label="Project menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-md border border-line bg-raised text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
      >
        <MoreIcon />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Project"
          onKeyDown={handleKeyDown}
          className="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border border-line-strong bg-raised p-1 shadow-lg"
        >
          <MenuItem
            itemRef={(element) => {
              items.current[0] = element
            }}
            disabled={!hasModel || !onExportProject}
            onClick={save}
          >
            Save project
          </MenuItem>
          <MenuItem
            itemRef={(element) => {
              items.current[1] = element
            }}
            disabled={!onImportProject}
            onClick={chooseFile}
          >
            Open project
          </MenuItem>
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept=".json"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          const input = event.target
          const file = input.files?.[0]
          if (!file) return
          void readProjectFile(file).then((spec) => {
            if (spec) onImportProject?.(spec)
          })
          input.value = ''
        }}
      />
    </div>
  )
}

function MenuItem({
  itemRef,
  disabled,
  onClick,
  children,
}: {
  itemRef: (element: HTMLButtonElement | null) => void
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      ref={itemRef}
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-full items-center rounded px-3 text-left text-sm text-ink-muted transition-colors hover:bg-overlay hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
