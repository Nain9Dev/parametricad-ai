interface Segment<T extends string> {
  value: T
  label: string
  title?: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  segments: Segment<T>[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}

/**
 * A radio group styled as a row of segments.
 *
 * Built on `role="radiogroup"` rather than a row of buttons so arrow keys move
 * between options and a screen reader announces the selection as one choice.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  segments,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  const height = size === 'sm' ? 'h-7 text-[0.6875rem]' : 'h-9 text-xs'

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full rounded-md border border-line bg-raised p-0.5"
    >
      {segments.map((segment) => {
        const selected = segment.value === value
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={segment.title ?? segment.label}
            onClick={() => onChange(segment.value)}
            className={[
              'flex-1 rounded font-medium transition-colors',
              height,
              selected
                ? 'bg-accent text-accent-ink'
                : 'text-ink-muted hover:bg-overlay hover:text-ink',
            ].join(' ')}
          >
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}
