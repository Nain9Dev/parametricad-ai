import type { ComponentSpec } from '@/types/api'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Pull a component specification out of a saved project.
 *
 * A project can arrive in three shapes: the full export written by Save project
 * (`{ model: { spec } }`), a bare `{ spec }` wrapper, or the specification
 * itself. Anything else, including text that is not JSON, yields `null` so the
 * caller can ignore the file instead of failing on it.
 */
export function parseProjectSpec(text: string): ComponentSpec | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const model = parsed['model']
  const wrapped = isRecord(model) ? model['spec'] : undefined
  const candidate = isRecord(wrapped) ? wrapped : isRecord(parsed['spec']) ? parsed['spec'] : parsed

  return typeof candidate['kind'] === 'string' ? (candidate as unknown as ComponentSpec) : null
}

/** Read a project file the user picked, or `null` when it is not a project. */
export function readProjectFile(file: File): Promise<ComponentSpec | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(parseProjectSpec(String(reader.result)))
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}
