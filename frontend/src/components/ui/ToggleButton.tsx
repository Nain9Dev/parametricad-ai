import type { ReactNode } from 'react'

interface ToggleButtonProps {
  label: string
  pressed: boolean
  onToggle: (pressed: boolean) => void
  children: ReactNode
}

/** An icon button whose on/off state is exposed through `aria-pressed`. */
export function ToggleButton({ label, pressed, onToggle, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={() => onToggle(!pressed)}
      className={[
        'inline-flex size-8 items-center justify-center rounded-md border transition-colors',
        pressed
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-line bg-raised text-ink-faint hover:border-line-strong hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
