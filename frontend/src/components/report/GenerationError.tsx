import { Button } from '@/components/ui/Button'
import { AlertIcon, ResetIcon } from '@/components/ui/Icons'
import type { ApiError } from '@/lib/apiClient'
import { humaniseFieldName } from '@/lib/format'

interface Violation {
  field: string
  message: string
}

interface GenerationErrorProps {
  error: ApiError
  onRetry?: (() => void) | undefined
}

/**
 * Renders a failure the way the backend described it.
 *
 * The API answers with a code, a message and a hint, plus the specific rules a
 * request broke. Surfacing all three turns "generation failed" into something
 * the engineer can act on without opening a network inspector.
 */
export function GenerationError({ error, onRetry }: GenerationErrorProps) {
  const violations = extractViolations(error)

  return (
    <div
      role="alert"
      className="space-y-3 rounded-panel border border-invalid/35 bg-invalid/8 p-4"
    >
      <div className="flex items-start gap-2.5">
        <AlertIcon className="mt-0.5 size-4 shrink-0 text-invalid" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-ink">{error.message}</p>
          {error.hint ? <p className="text-xs text-ink-muted">{error.hint}</p> : null}
        </div>
      </div>

      {violations.length > 0 ? (
        <ul className="space-y-1 border-t border-invalid/20 pt-2.5">
          {violations.map((violation, index) => (
            <li key={`${violation.field}-${index}`} className="text-[0.6875rem] leading-snug">
              <span className="font-medium text-invalid">
                {humaniseFieldName(lastSegment(violation.field))}
              </span>
              <span className="text-ink-muted"> - {violation.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-invalid/20 pt-2.5">
        <code className="text-[0.625rem] text-ink-faint">{error.code}</code>
        {onRetry && error.isRetryable ? (
          <Button size="sm" variant="secondary" onClick={onRetry} icon={<ResetIcon className="size-3.5" />}>
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Pull the per-field rules out of the untyped `details` bag, if present. */
function extractViolations(error: ApiError): Violation[] {
  const raw = error.details['violations']
  if (!Array.isArray(raw)) return []

  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const record = entry as Record<string, unknown>
    const field = typeof record['field'] === 'string' ? record['field'] : ''
    const message = typeof record['message'] === 'string' ? record['message'] : ''
    return message ? [{ field, message }] : []
  })
}

/** Pydantic reports a path such as `spec.pipe`; only the leaf is meaningful. */
function lastSegment(field: string): string {
  const segments = field.split('.')
  return segments[segments.length - 1] ?? field
}
