import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Spinner } from '@/components/ui/Spinner'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  busy?: boolean
  icon?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-line disabled:text-ink-faint',
  secondary:
    'bg-overlay text-ink border border-line-strong hover:bg-line disabled:text-ink-faint',
  ghost: 'text-ink-muted hover:text-ink hover:bg-overlay disabled:text-ink-faint',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      // `busy` is announced rather than implied by the spinner alone, and the
      // button stays disabled so a second submit cannot queue behind the first.
      aria-busy={busy || undefined}
      disabled={disabled ?? busy}
      className={[
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {busy ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  )
}
