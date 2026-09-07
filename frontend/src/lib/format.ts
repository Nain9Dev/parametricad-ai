/** Presentation helpers for engineering quantities. */

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const PRECISE = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const INTEGER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const PERCENT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 3,
})

export function formatNumber(value: number): string {
  return NUMBER.format(value)
}

export function formatCount(value: number): string {
  return INTEGER.format(value)
}

export function formatPercent(value: number): string {
  return PERCENT.format(value)
}

export function formatMillimetres(value: number): string {
  return `${PRECISE.format(value)} mm`
}

/**
 * Volumes span many orders of magnitude, from a washer to a beam, so the unit
 * moves with the value rather than printing ten digits of cubic millimetres.
 */
export function formatVolume(mm3: number): string {
  if (mm3 >= 1_000_000) return `${NUMBER.format(mm3 / 1_000_000)} dm3`
  if (mm3 >= 1_000) return `${NUMBER.format(mm3 / 1_000)} cm3`
  return `${NUMBER.format(mm3)} mm3`
}

export function formatArea(mm2: number): string {
  if (mm2 >= 1_000_000) return `${NUMBER.format(mm2 / 1_000_000)} m2`
  if (mm2 >= 100) return `${NUMBER.format(mm2 / 100)} cm2`
  return `${NUMBER.format(mm2)} mm2`
}

export function formatMass(grams: number): string {
  return grams >= 1_000
    ? `${NUMBER.format(grams / 1_000)} kg`
    : `${NUMBER.format(grams)} g`
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${NUMBER.format(bytes / 1_048_576)} MB`
  if (bytes >= 1_024) return `${NUMBER.format(bytes / 1_024)} kB`
  return `${INTEGER.format(bytes)} B`
}

export function formatDuration(milliseconds: number): string {
  return milliseconds >= 1_000
    ? `${NUMBER.format(milliseconds / 1_000)} s`
    : `${INTEGER.format(milliseconds)} ms`
}

/** ``outer_diameter_mm`` is unreadable in a summary; ``Outer diameter`` is not. */
export function humaniseFieldName(name: string): string {
  const withoutUnit = name.replace(/_(mm|deg|g)$/, '')
  const words = withoutUnit.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
