import { useEffect, useId, useState } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  unit?: string | null
  description?: string | null
  minimum?: number | null
  maximum?: number | null
  exclusiveMinimum?: boolean
  step?: number | null
  integer?: boolean
  disabled?: boolean
}

/**
 * A numeric input that keeps the text the user is typing separate from the
 * committed value.
 *
 * Reformatting the field on every keystroke would make "2." or "0.05"
 * impossible to type, so the draft string is what the input shows while the
 * numeric value only moves when the draft parses to something valid and in
 * range. An out-of-range draft is reported rather than silently clamped: the
 * bounds come from the backend schema, and quietly changing the number would
 * hide the fact that the requested part cannot be built.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  description,
  minimum,
  maximum,
  exclusiveMinimum = false,
  step,
  integer = false,
  disabled = false,
}: NumberFieldProps) {
  const inputId = useId()
  const messageId = `${inputId}-message`
  const [draft, setDraft] = useState(() => String(value))

  // Follow the value when it changes elsewhere -- switching component kind, or
  // a prompt filling the form in -- without disturbing an in-progress edit.
  useEffect(() => {
    setDraft((current) => (Number.parseFloat(current) === value ? current : String(value)))
  }, [value])

  const parsed = Number.parseFloat(draft)
  const violation = describeViolation(parsed, {
    minimum,
    maximum,
    exclusiveMinimum,
    integer,
  })

  function commit(next: string) {
    setDraft(next)
    const candidate = Number.parseFloat(next)
    if (!Number.isFinite(candidate)) return
    if (describeViolation(candidate, { minimum, maximum, exclusiveMinimum, integer })) return
    onChange(integer ? Math.round(candidate) : candidate)
  }

  function nudge(direction: 1 | -1) {
    const increment = (step ?? 1) * direction
    const base = Number.isFinite(parsed) ? parsed : value
    const next = clamp(round(base + increment, increment), minimum, maximum, exclusiveMinimum)
    commit(String(next))
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
          {label}
        </label>
        {unit ? <span className="text-[0.6875rem] text-ink-faint">{unit}</span> : null}
      </div>

      <div
        className={[
          'flex items-stretch overflow-hidden rounded-md border bg-raised',
          'focus-within:border-accent',
          violation ? 'border-invalid' : 'border-line',
        ].join(' ')}
      >
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          className="numeric min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none disabled:text-ink-faint"
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => setDraft(String(value))}
          disabled={disabled}
          step={step ?? undefined}
          min={minimum ?? undefined}
          max={maximum ?? undefined}
          aria-invalid={violation ? true : undefined}
          aria-describedby={violation ?? description ? messageId : undefined}
        />
        <div className="flex flex-col border-l border-line">
          <StepButton label={`Increase ${label}`} onClick={() => nudge(1)} disabled={disabled}>
            +
          </StepButton>
          <StepButton label={`Decrease ${label}`} onClick={() => nudge(-1)} disabled={disabled}>
            -
          </StepButton>
        </div>
      </div>

      {violation ?? description ? (
        <p
          id={messageId}
          className={`text-[0.6875rem] ${violation ? 'text-invalid' : 'text-ink-faint'}`}
        >
          {violation ?? description}
        </p>
      ) : null}
    </div>
  )
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      tabIndex={-1}
      onClick={onClick}
      disabled={disabled}
      className="flex h-1/2 w-7 items-center justify-center text-xs leading-none text-ink-faint transition-colors hover:bg-overlay hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  )
}

interface Constraints {
  minimum: number | null | undefined
  maximum: number | null | undefined
  exclusiveMinimum: boolean
  integer: boolean
}

function describeViolation(value: number, constraints: Constraints): string | null {
  const { minimum, maximum, exclusiveMinimum, integer } = constraints

  if (!Number.isFinite(value)) return 'Enter a number.'
  if (integer && !Number.isInteger(value)) return 'Must be a whole number.'
  if (minimum !== null && minimum !== undefined) {
    if (exclusiveMinimum && value <= minimum) return `Must be greater than ${minimum}.`
    if (!exclusiveMinimum && value < minimum) return `Must be at least ${minimum}.`
  }
  if (maximum !== null && maximum !== undefined && value > maximum) {
    return `Must be at most ${maximum}.`
  }
  return null
}

function clamp(
  value: number,
  minimum: number | null | undefined,
  maximum: number | null | undefined,
  exclusiveMinimum: boolean,
): number {
  let next = value
  if (minimum !== null && minimum !== undefined && next < minimum) {
    next = exclusiveMinimum ? minimum + Number.EPSILON : minimum
  }
  if (maximum !== null && maximum !== undefined && next > maximum) next = maximum
  return next
}

/** Keep the result on the step grid instead of accumulating float noise. */
function round(value: number, increment: number): number {
  const decimals = decimalsOf(increment)
  return Number.parseFloat(value.toFixed(decimals))
}

function decimalsOf(increment: number): number {
  const text = String(Math.abs(increment))
  const separator = text.indexOf('.')
  return separator === -1 ? 0 : text.length - separator - 1
}
