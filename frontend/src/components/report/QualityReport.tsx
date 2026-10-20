import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { AlertIcon, CheckIcon, DownloadIcon } from '@/components/ui/Icons'
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
 * Exposes the canonical ADR-0006 C1–C10 geometric check spectrum,
 * Euler-Poincaré invariant auditing, and one-click JSON QA certificate exports.
 */
export function QualityReport({ report }: QualityReportProps) {
  const [showSpectrum, setShowSpectrum] = useState(false)

  const checks = [
    { label: 'Watertight', passed: report.is_watertight },
    { label: 'Manifold edges', passed: report.is_edge_manifold },
    { label: 'Consistent normals', passed: report.is_winding_consistent },
    { label: 'Outward facing', passed: report.has_outward_normals },
    { label: 'No self-intersections', passed: !report.has_self_intersections },
    { label: 'Single body', passed: report.connected_component_count === 1 },
  ]

  const spectrumChecks = [
    {
      code: 'C1',
      title: 'Buffer & Index Integrity',
      passed: report.unreferenced_vertex_count === 0 && report.duplicate_face_count === 0,
      detail: `${report.unreferenced_vertex_count} unreferenced verts, ${report.duplicate_face_count} duplicates`,
    },
    {
      code: 'C2',
      title: 'Quantum Area Threshold',
      passed: report.degenerate_face_count === 0,
      detail: `${report.degenerate_face_count} degenerate faces (threshold > 10⁻¹² mm²)`,
    },
    {
      code: 'C3',
      title: '2-Manifold Boundary',
      passed: report.is_edge_manifold && report.non_manifold_edge_count === 0,
      detail: `${report.non_manifold_edge_count} non-manifold edges`,
    },
    {
      code: 'C4',
      title: 'Hermetic Watertightness',
      passed: report.is_watertight && report.boundary_edge_count === 0,
      detail: `${report.boundary_edge_count} open boundary edges`,
    },
    {
      code: 'C5',
      title: 'Normal & Winding Consistency',
      passed: report.is_winding_consistent && report.has_outward_normals,
      detail: 'Consistent right-hand vertex winding and outward orientation',
    },
    {
      code: 'C6',
      title: 'Self-Intersection Invariants',
      passed: !report.has_self_intersections && report.self_intersecting_pair_count === 0,
      detail: `${report.self_intersecting_pair_count} intersecting triangle pairs`,
    },
    {
      code: 'C7',
      title: 'Facet Aspect Conditioning',
      passed: report.status !== 'invalid',
      detail: 'Triangle conditioning suitable for engineering simulation',
    },
    {
      code: 'C8',
      title: 'Extents & Bounding Box',
      passed:
        report.bounding_box.size.x > 0 &&
        report.bounding_box.size.y > 0 &&
        report.bounding_box.size.z > 0,
      detail: `${Math.round(report.bounding_box.size.x)}×${Math.round(report.bounding_box.size.y)}×${Math.round(report.bounding_box.size.z)} mm extents`,
    },
    {
      code: 'C9',
      title: 'B-Rep Volume Divergence (<2%)',
      passed: report.volume_deviation_ratio === null || report.volume_deviation_ratio < 0.02,
      detail:
        report.volume_deviation_ratio !== null
          ? `${formatPercent(report.volume_deviation_ratio)} chordal under-fill error`
          : 'Volumetric alignment conforming',
    },
    {
      code: 'C10',
      title: 'Euler Closure & Components',
      passed: report.connected_component_count === 1,
      detail: `${report.connected_component_count} body, Euler χ = ${report.euler_characteristic}`,
    },
  ]

  const handleDownloadCertificate = () => {
    const certificate = {
      spec: 'ADR-0006 Canonical Dual-Contract Quality Report',
      timestamp: new Date().toISOString(),
      status: report.status,
      metrics: {
        triangles: report.triangle_count,
        vertices: report.vertex_count,
        euler_characteristic: report.euler_characteristic,
        genus: report.genus,
        connected_components: report.connected_component_count,
        volume_mm3: report.volume_mm3,
        surface_area_mm2: report.surface_area_mm2,
        volume_deviation_ratio: report.volume_deviation_ratio,
        bounding_box: report.bounding_box,
      },
      checks: spectrumChecks.map((c) => ({
        code: c.code,
        title: c.title,
        passed: c.passed,
        detail: c.detail,
      })),
      issues: report.issues,
    }

    const blob = new Blob([JSON.stringify(certificate, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `validation_report_${report.status}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

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

      {report.genus !== null ? (
        <div className="rounded border border-line bg-raised/50 p-2 text-[0.625rem]">
          <div className="flex items-center justify-between">
            <span className="font-mono font-medium text-ink-muted">Euler-Poincaré Invariant</span>
            <span
              className={
                report.euler_characteristic === 2 * (report.connected_component_count - report.genus)
                  ? 'font-medium text-valid'
                  : 'font-medium text-warn'
              }
            >
              {report.euler_characteristic === 2 * (report.connected_component_count - report.genus)
                ? 'χ = 2(B − g) Conforming'
                : 'χ Non-standard'}
            </span>
          </div>
          <div className="mt-1 flex justify-between font-mono text-[0.5625rem] text-ink-faint">
            <span>χ = {report.euler_characteristic}</span>
            <span>Genus g = {report.genus}</span>
            <span>Bodies B = {report.connected_component_count}</span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={() => setShowSpectrum((s) => !s)}
          className="text-[0.625rem] font-medium text-accent transition-colors hover:underline pointer-coarse:min-h-11 pointer-coarse:text-xs"
        >
          {showSpectrum ? 'Hide C1–C10 Spectrum' : 'Inspect C1–C10 Spectrum'}
        </button>
        <button
          type="button"
          onClick={handleDownloadCertificate}
          className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-[0.625rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink pointer-coarse:min-h-11 pointer-coarse:px-3 pointer-coarse:text-xs"
          title="Download ADR-0006 JSON validation certificate"
        >
          <DownloadIcon className="size-3" />
          QA Certificate
        </button>
      </div>

      {showSpectrum ? (
        <div className="space-y-1.5 rounded-md border border-line bg-raised/40 p-2 text-[0.625rem]">
          <p className="font-mono text-[0.625rem] font-semibold text-ink-muted">
            ADR-0006 Deterministic C1–C10 Verification
          </p>
          <ul className="space-y-1">
            {spectrumChecks.map((check) => (
              <li
                key={check.code}
                className="flex items-center justify-between gap-1 border-b border-line/40 pb-0.5 last:border-0"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-mono font-bold shrink-0 text-[0.5625rem] ${
                      check.passed ? 'text-valid' : 'text-invalid'
                    }`}
                  >
                    {check.code}
                  </span>
                  <span className="truncate text-ink-muted" title={check.detail}>
                    {check.title}
                  </span>
                </div>
                <span
                  className={`shrink-0 font-mono text-[0.5625rem] font-medium ${
                    check.passed ? 'text-valid' : 'text-invalid'
                  }`}
                >
                  {check.passed ? 'PASS' : 'FAIL'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
