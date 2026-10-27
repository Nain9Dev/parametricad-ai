import { AlertIcon, CheckIcon } from '@/components/ui/Icons'
import { formatCount } from '@/lib/format'
import type { MeshQualityReport, MeshQualityStatus } from '@/types/api'

interface ViewerVerdictProps {
  report: MeshQualityReport
  /** Opens the full report, which lives in the Report tab. */
  onDetails: () => void
}

/** The same words and tones as the Mesh validation card, so the two agree. */
const STATUS: Record<MeshQualityStatus, { label: string; tone: string; Icon: typeof CheckIcon }> = {
  valid: { label: 'Valid', tone: 'text-valid', Icon: CheckIcon },
  degraded: { label: 'Degraded', tone: 'text-warn', Icon: AlertIcon },
  invalid: { label: 'Invalid', tone: 'text-invalid', Icon: AlertIcon },
}

/**
 * The verdict, said where the user is looking.
 *
 * On a compact screen the Mesh validation card sits in the Report tab, out of
 * sight on the first screen, where it was a coloured dot beside the tab's name.
 * This chip puts the verdict and the triangle count over the viewer and leads to
 * the card. It is not drawn on the wide layout, where the card is beside the
 * viewer already.
 */
export function ViewerVerdict({ report, onDetails }: ViewerVerdictProps) {
  const { label, tone, Icon } = STATUS[report.status]
  return (
    <button
      type="button"
      onClick={onDetails}
      title="Open the mesh validation report"
      className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 text-xs shadow-lg backdrop-blur transition-colors hover:border-line-strong pointer-coarse:h-11"
    >
      <Icon className={`size-3.5 shrink-0 ${tone}`} />
      <span className={`font-medium ${tone}`}>{label}</span>
      <span aria-hidden="true" className="text-ink-faint">
        ·
      </span>
      <span className="text-ink-muted">{formatCount(report.triangle_count)} triangles</span>
    </button>
  )
}
