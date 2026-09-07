import type { ComponentDescriptor, ComponentKind } from '@/types/api'

interface ComponentPickerProps {
  components: ComponentDescriptor[]
  value: ComponentKind
  onChange: (kind: ComponentKind) => void
  disabled?: boolean
}

export function ComponentPicker({
  components,
  value,
  onChange,
  disabled = false,
}: ComponentPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Component type"
      className="grid grid-cols-2 gap-1.5"
    >
      {components.map((component) => {
        const selected = component.kind === value
        return (
          <button
            key={component.kind}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={component.description}
            onClick={() => onChange(component.kind)}
            className={[
              'rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              selected
                ? 'border-accent/45 bg-accent/12 text-accent'
                : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink',
            ].join(' ')}
          >
            {component.label}
          </button>
        )
      })}
    </div>
  )
}
