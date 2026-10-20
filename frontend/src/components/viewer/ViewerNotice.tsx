import { Button } from '@/components/ui/Button'
import { AlertIcon, ResetIcon } from '@/components/ui/Icons'
import type { ApiError } from '@/lib/apiClient'

interface ViewerNoticeProps {
  error: ApiError
  onRetry?: (() => void) | undefined
  /** Opens the full explanation, which lives in the Report. */
  onDetails: () => void
}

/**
 * A failure, said where the user is looking.
 *
 * On a compact screen the full error sits in the Report tab, out of sight while
 * a parameter is being edited. The last model stays in the viewer when a request
 * fails, so this strip tells the user that what they see is not the result of
 * their last change, and how to try again.
 */
export function ViewerNotice({ error, onRetry, onDetails }: ViewerNoticeProps) {
  return (
    <div
      role="alert"
      className="pointer-events-auto flex items-center gap-2 rounded-md border border-invalid/35 bg-surface/95 py-1.5 pr-1.5 pl-3 text-xs shadow-lg backdrop-blur"
    >
      <AlertIcon className="size-4 shrink-0 text-invalid" />
      <p className="line-clamp-2 min-w-0 flex-1 text-ink">{error.message}</p>
      {onRetry && error.isRetryable ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={onRetry}
          icon={<ResetIcon className="size-3.5" />}
        >
          Retry
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={onDetails}>
        Details
      </Button>
    </div>
  )
}
