import { Badge } from '@/components/ui/Badge'
import { AlertIcon, CheckIcon } from '@/components/ui/Icons'
import { formatCount, formatPercent } from '@/lib/format'
import type { MeshQualityReport as Report, MeshQualityStatus } from '@/types/api'

const STATUS_TONE: Record<MeshQualityStatus, 'valid' | 'warn' | 'invalid'> = {
  valid: 'valid',
  degraded: 'warn',
  invalid: 'invalid',
}

const STATUS_LABEL: Record<MeshQualityStatus, string> = {
  valid: 'Valid',
  degraded: 'Degraded',
  invalid: 'Invalid',
}

interface QualityReportProps {
  report: Report
}

/**
 * The mesh verdict, in the order an engineer would check it.
 *
 * The headline is the verdict, then the individual checks, then the detail. The
 * numbers below the checks are what makes the verdict auditable rather than
 * something to take on faith.
 */
export function QualityReport({ report }: QualityReportProps) {
  const checks = [
    { label: 'Watertight', passed: report.is_watertight },
    { label: 'Manifold edges', passed: report.is_edge_manifold },
    { label: 'Consistent normals', passed: report.is_winding_consistent },
    { label: 'Outward facing', passed: report.has_outward_normals },
    { label: 'No self-intersections', passed: !report.has_self_intersections },
    { label: 'Single body', passed: report.connected_component_count === 1 },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={STATUS_TONE[report.status]}>
          {report.status === 'valid' ? (
            <CheckIcon className="size-3" />
          ) : (
            <AlertIcon className="size-3" />
          )}
          {STATUS_LABEL[report.status]}
        </Badge>
        <span className="numeric text-[0.6875rem] text-ink-faint">
          {formatCount(report.triangle_count)} triangles
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-1.5 text-[0.6875rem]">
            <span
              aria-hidden="true"
              className={`flex size-3.5 shrink-0 items-center justify-center rounded-full ${
                check.passed ? 'bg-valid/15 text-valid' : 'bg-invalid/15 text-invalid'
              }`}
            >
              {check.passed ? (
                <CheckIcon className="size-2.5" />
              ) : (
                <AlertIcon className="size-2.5" />
              )}
            </span>
            <span className={check.passed ? 'text-ink-muted' : 'text-invalid'}>
              {check.label}
            </span>
            <span className="sr-only">{check.passed ? ': pass' : ': fail'}</span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[0.6875rem]">
        <Metric label="Genus" value={report.genus === null ? 'n/a' : String(report.genus)} />
        <Metric label="Euler characteristic" value={String(report.euler_characteristic)} />
        <Metric label="Bodies" value={String(report.connected_component_count)} />
        <Metric label="Vertices" value={formatCount(report.vertex_count)} />
        {report.volume_deviation_ratio !== null ? (
          <Metric
            label="Volume error vs solid"
            value={formatPercent(report.volume_deviation_ratio)}
            hint="Gap between the tessellated mesh and the exact kernel volume."
          />
        ) : null}
        {!report.self_intersection_check_complete ? (
          <Metric
            label="Intersection sweep"
            value="Partial"
            hint="The candidate budget was reached before every pair was tested."
          />
        ) : null}
      </dl>

      {report.issues.length > 0 ? (
        <ul className="space-y-1.5 border-t border-line pt-3">
          {report.issues.map((issue) => (
            <li
              key={issue.code}
              className={`flex gap-2 rounded border px-2 py-1.5 text-[0.6875rem] leading-snug ${
                issue.severity === 'error'
                  ? 'border-invalid/30 bg-invalid/8 text-invalid'
                  : 'border-warn/30 bg-warn/8 text-warn'
              }`}
            >
              <AlertIcon className="mt-px size-3 shrink-0" />
              <span>
                {issue.message}
                {issue.count !== null ? (
                  <span className="numeric opacity-75"> ({formatCount(issue.count)})</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" title={hint}>
      <dt className="truncate text-ink-faint">{label}</dt>
      <dd className="numeric shrink-0 text-ink-muted">{value}</dd>
    </div>
  )
}
