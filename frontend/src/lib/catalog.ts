/**
 * Helpers for turning catalog descriptors into form state and back into an API
 * payload.
 *
 * The catalog is the only source of field names, defaults and limits, so
 * nothing here hardcodes a parameter: adding a field to a component on the
 * backend makes it appear in the form with no frontend change.
 */

import type {
  ComponentDescriptor,
  ComponentKind,
  ComponentSpec,
  ParameterDescriptor,
  ParameterValue,
} from '@/types/api'

export type ParameterValues = Record<string, ParameterValue>

export interface ParameterGroup {
  name: string
  parameters: ParameterDescriptor[]
}

/** The starting values for a component, taken from the schema defaults. */
export function defaultValues(component: ComponentDescriptor): ParameterValues {
  const values: ParameterValues = {}
  for (const parameter of component.parameters) {
    if (parameter.default !== null) values[parameter.name] = parameter.default
  }
  return values
}

/** Assemble the request payload for the API. */
export function buildSpec(kind: ComponentKind, values: ParameterValues): ComponentSpec {
  return { ...values, kind } as ComponentSpec
}

/**
 * The text a request is remembered and compared by.
 *
 * The live preview sends a request when the form settles on values that were not
 * sent yet, and it decides that by comparing text. A specification read from a
 * showcase card lists its fields in another order than the form does, so the
 * card's own text never matched the form's and every load and every card was
 * followed by the same request again. Whatever remembers a request on the form's
 * behalf builds its text here, from the values the form will hold.
 */
export function serializeSpec(kind: ComponentKind, values: ParameterValues): string {
  return JSON.stringify(buildSpec(kind, values))
}

/**
 * Read a returned specification back into form state.
 *
 * Used after a prompt: the extracted parameters populate the form so the part
 * can be refined by hand from there instead of being re-described in prose.
 */
export function valuesFromSpec(
  spec: ComponentSpec,
  component: ComponentDescriptor,
): ParameterValues {
  const values: ParameterValues = {}
  for (const parameter of component.parameters) {
    const value = spec[parameter.name]
    if (value !== undefined) values[parameter.name] = value
  }
  return values
}

/** Group parameters for display, preserving the order the catalog declares. */
export function groupParameters(component: ComponentDescriptor): ParameterGroup[] {
  const groups: ParameterGroup[] = []
  for (const parameter of component.parameters) {
    const existing = groups.find((group) => group.name === parameter.group)
    if (existing) existing.parameters.push(parameter)
    else groups.push({ name: parameter.group, parameters: [parameter] })
  }
  return groups
}

export function findComponent(
  components: ComponentDescriptor[],
  kind: ComponentKind,
): ComponentDescriptor | undefined {
  return components.find((component) => component.kind === kind)
}
