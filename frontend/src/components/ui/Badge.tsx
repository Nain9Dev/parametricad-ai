import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'valid' | 'warn' | 'invalid'

const TONES: Record<Tone, string> = {
  neutral: 'bg-overlay text-ink-muted border-line-strong',
  accent: 'bg-accent/12 text-accent border-accent/35',
  valid: 'bg-valid/12 text-valid border-valid/35',
  warn: 'bg-warn/12 text-warn border-warn/35',
  invalid: 'bg-invalid/12 text-invalid border-invalid/35',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[0.6875rem] font-medium tracking-wide uppercase',
        TONES[tone],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
