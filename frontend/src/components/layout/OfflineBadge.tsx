import { Badge } from '@/components/ui/Badge'

/**
 * Shown in the header while the device has no connection.
 *
 * The bundled presets and the app itself keep working; generating, refining and
 * exporting need the service, and say so when they are tried.
 */
export function OfflineBadge() {
  return (
    <span role="status">
      <Badge tone="warn">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" />
        Offline
      </Badge>
    </span>
  )
}
