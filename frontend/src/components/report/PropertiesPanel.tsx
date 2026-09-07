import {
  formatArea,
  formatDuration,
  formatMass,
  formatMillimetres,
  formatVolume,
} from '@/lib/format'
import type { GeneratedModel } from '@/types/api'

interface PropertiesPanelProps {
  model: GeneratedModel
}

/**
 * Mass properties and the cost of producing them.
 *
 * The properties come from the exact B-Rep rather than the mesh, so they are
 * the values to quote; the timings sit alongside because a parametric preview
 * is only useful if its latency is visible.
 */
export function PropertiesPanel({ model }: PropertiesPanelProps) {
  const { properties, quality, timings } = model
  const size = quality.bounding_box.size

  return (
    <div className="space-y-3">
      <dl className="space-y-1.5 text-xs">
        <Row label="Volume" value={formatVolume(properties.volume_mm3)} />
        <Row label="Surface area" value={formatArea(properties.surface_area_mm2)} />
        <Row
          label="Mass"
          value={formatMass(properties.mass_g)}
          hint={`At ${properties.density_g_cm3} g/cm3`}
        />
        <Row
          label="Bounding box"
          value={`${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} mm`}
        />
        <Row label="Longest extent" value={formatMillimetres(Math.max(size.x, size.y, size.z))} />
      </dl>

      <div className="border-t border-line pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[0.6875rem] font-semibold tracking-wider text-ink-faint uppercase">
            Pipeline
          </p>
          <span className="numeric text-[0.6875rem] text-ink-muted">
            {model.cached ? 'served from cache' : formatDuration(timings.total_ms)}
          </span>
        </div>
        {model.cached ? (
          <p className="text-[0.6875rem] text-ink-faint">
            These parameters were built before, so the stored artifacts were reused.
          </p>
        ) : (
          <StageBars timings={timings} />
        )}
      </div>
    </div>
  )
}

function StageBars({ timings }: { timings: GeneratedModel['timings'] }) {
  const stages = [
    { label: 'Build', value: timings.build_ms },
    { label: 'Tessellate', value: timings.tessellate_ms },
    { label: 'Inspect', value: timings.inspect_ms },
    { label: 'Export', value: timings.export_ms },
  ]
  const total = Math.max(
    stages.reduce((sum, stage) => sum + stage.value, 0),
    0.001,
  )

  return (
    <ul className="space-y-1">
      {stages.map((stage) => (
        <li key={stage.label} className="flex items-center gap-2 text-[0.6875rem]">
          <span className="w-16 shrink-0 text-ink-faint">{stage.label}</span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <span
              className="block h-full rounded-full bg-accent/70"
              style={{ width: `${(stage.value / total) * 100}%` }}
            />
          </span>
          <span className="numeric w-14 shrink-0 text-right text-ink-muted">
            {formatDuration(stage.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3" title={hint}>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="numeric text-ink">{value}</dd>
    </div>
  )
}
