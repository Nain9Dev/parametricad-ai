import { NumberField } from '@/components/ui/NumberField'
import { SelectField } from '@/components/ui/SelectField'
import { groupParameters, type ParameterValues } from '@/lib/catalog'
import type { ComponentDescriptor, ParameterDescriptor, ParameterValue } from '@/types/api'

interface ParameterFormProps {
  component: ComponentDescriptor
  values: ParameterValues
  onChange: (name: string, value: ParameterValue) => void
  disabled?: boolean
}

/**
 * The parameter form, rendered entirely from the catalog.
 *
 * Every control -- its type, unit, step, bounds and default -- comes from the
 * backend's own schema, which is what keeps the form and the validation rules
 * from drifting apart.
 */
export function ParameterForm({
  component,
  values,
  onChange,
  disabled = false,
}: ParameterFormProps) {
  return (
    <div className="space-y-5">
      {groupParameters(component).map((group) => (
        <fieldset key={group.name} className="space-y-3" disabled={disabled}>
          <legend className="text-[0.6875rem] font-semibold tracking-wider text-ink-faint uppercase">
            {group.name}
          </legend>
          <div className="space-y-3">
            {group.parameters.map((parameter) => (
              <ParameterControl
                key={parameter.name}
                parameter={parameter}
                value={values[parameter.name]}
                onChange={(value) => onChange(parameter.name, value)}
                disabled={disabled}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

interface ParameterControlProps {
  parameter: ParameterDescriptor
  value: ParameterValue | undefined
  onChange: (value: ParameterValue) => void
  disabled: boolean
}

function ParameterControl({
  parameter,
  value,
  onChange,
  disabled,
}: ParameterControlProps) {
  if (parameter.type === 'enum') {
    return (
      <SelectField
        label={parameter.label}
        value={String(value ?? parameter.options[0]?.value ?? '')}
        options={parameter.options}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  return (
    <NumberField
      label={parameter.label}
      value={typeof value === 'number' ? value : Number(parameter.default ?? 0)}
      onChange={onChange}
      unit={parameter.unit}
      description={parameter.description}
      minimum={parameter.minimum}
      maximum={parameter.maximum}
      exclusiveMinimum={parameter.exclusive_minimum}
      step={parameter.step}
      integer={parameter.type === 'integer'}
      disabled={disabled}
    />
  )
}
