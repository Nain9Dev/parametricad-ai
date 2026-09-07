import type { ReactNode } from 'react'

interface PanelProps {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/** A titled surface. The one container shape the whole interface is built from. */
export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4',
}: PanelProps) {
  return (
    <section
      className={`rounded-panel border border-line bg-surface ${className}`}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-ink-faint">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
