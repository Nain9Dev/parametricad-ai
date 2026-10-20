import { useRef, type KeyboardEvent } from 'react'

import {
  WORKSPACE_TABS,
  workspacePanelId,
  workspaceTabId,
  type ReportIndicator,
  type WorkspaceTab,
} from '@/components/layout/workspaceSections'

const DOT_TONE: Record<ReportIndicator['tone'], string> = {
  valid: 'bg-valid',
  warn: 'bg-warn',
  invalid: 'bg-invalid',
}

interface WorkspaceTabsProps {
  value: WorkspaceTab
  onChange: (tab: WorkspaceTab) => void
  reportIndicator?: ReportIndicator | null
  className?: string
}

/**
 * The section switcher of the compact workspace.
 *
 * ARIA tabs with automatic activation: arrow keys move the selection and the
 * focus together, and only the selected tab sits in the tab order. The panels it
 * controls are owned by the caller, which hides the inactive ones instead of
 * unmounting them so a half-edited form keeps its state.
 */
export function WorkspaceTabs({
  value,
  onChange,
  reportIndicator = null,
  className = '',
}: WorkspaceTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = WORKSPACE_TABS.length - 1
    let next: number
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1
        break
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    event.preventDefault()
    const target = WORKSPACE_TABS[next]
    if (!target) return
    onChange(target.id)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Workspace sections"
      className={`grid grid-cols-4 border-y border-line bg-surface ${className}`}
    >
      {WORKSPACE_TABS.map((tab, index) => {
        const selected = tab.id === value
        const indicator = tab.id === 'report' ? reportIndicator : null
        return (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            id={workspaceTabId(tab.id)}
            aria-selected={selected}
            aria-controls={selected ? workspacePanelId(tab.id) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={[
              'relative flex min-h-12 items-center justify-center gap-1.5 px-1 text-xs font-medium transition-colors',
              selected
                ? 'text-accent after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:rounded-full after:bg-accent'
                : 'text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {indicator ? (
              <>
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${DOT_TONE[indicator.tone]}`}
                />
                <span className="sr-only">, {indicator.label}</span>
              </>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
