import { useId } from 'react'

interface Option {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  description?: string | null
  disabled?: boolean
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  description,
  disabled = false,
}: SelectFieldProps) {
  const inputId = useId()
  const descriptionId = `${inputId}-description`

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <select
        id={inputId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:text-ink-faint"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description ? (
        <p id={descriptionId} className="text-[0.6875rem] text-ink-faint">
          {description}
        </p>
      ) : null}
    </div>
  )
}
