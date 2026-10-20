import { SHOWCASE_PRESETS } from '@/lib/presets'
import type { ComponentSpec } from '@/types/api'

/**
 * Which requests a bundled model may answer (ADR-0008).
 *
 * The models under `public/presets/` are the answers to four exact
 * specifications and one exact prompt. They stand in for the generation service
 * only when the request is that same request: anything else would show a part
 * the user did not ask for.
 */

export type BundledKind = 'flange' | 'elbow' | 'pipe' | 'plate'

/** Same keys, same values, whatever the order of the keys. */
export function specsEqual(a: ComponentSpec, b: ComponentSpec): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
}

/** The bundled model that is the answer to exactly this specification, if any. */
export function bundledKindForSpec(spec: ComponentSpec): BundledKind | null {
  const match = SHOWCASE_PRESETS.find(
    (preset) => preset.id !== 'prompt' && specsEqual(preset.spec, spec),
  )
  return match ? (match.kind as BundledKind) : null
}

/** Case and spacing never change what a sentence asks for. */
export function normalisePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** The bundled model that is the answer to exactly this prompt, if any. */
export function bundledKindForPrompt(prompt: string): BundledKind | null {
  const wanted = normalisePrompt(prompt)
  if (wanted === '') return null
  const match = SHOWCASE_PRESETS.find(
    (preset) => preset.promptText !== undefined && normalisePrompt(preset.promptText) === wanted,
  )
  return match ? (match.kind as BundledKind) : null
}
