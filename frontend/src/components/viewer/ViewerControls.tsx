import type { ComponentType } from 'react'

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ToggleButton } from '@/components/ui/ToggleButton'
import {
  AxesIcon,
  CaliperIcon,
  EdgesIcon,
  GridIcon,
  ResetIcon,
  RulerIcon,
  SectionIcon,
  WireframeIcon,
} from '@/components/ui/Icons'
import type { ViewOrientation } from '@/components/viewer/viewDirections'
import type { SectionAxis, ShadingMode, ViewerOptions } from '@/components/viewer/viewerOptions'

/**
 * The individual viewer controls.
 *
 * The wide toolbar lays them out in a strip and the compact one moves most of
 * them into a sheet, so each is a component of its own: one implementation of
 * every control, two arrangements of them.
 */

export interface ViewerControlProps {
  options: ViewerOptions
  onChange: (options: ViewerOptions) => void
}

type ToggleKey =
  | 'edges'
  | 'wireframe'
  | 'grid'
  | 'axes'
  | 'dimensions'
  | 'sectionPlane'
  | 'caliper'

interface ToggleDefinition {
  key: ToggleKey
  /** The accessible name of the icon-only button in the wide toolbar. */
  label: string
  /** The visible text next to the icon in the sheet. */
  short: string
  Icon: ComponentType<{ className?: string }>
}

const TOGGLES: readonly ToggleDefinition[] = [
  { key: 'edges', label: 'Feature crease edges', short: 'Crease edges', Icon: EdgesIcon },
  { key: 'wireframe', label: 'Wireframe shading', short: 'Wireframe', Icon: WireframeIcon },
  { key: 'grid', label: 'Ground grid', short: 'Ground grid', Icon: GridIcon },
  { key: 'axes', label: 'Axis gizmo', short: 'Axis gizmo', Icon: AxesIcon },
  { key: 'dimensions', label: 'Bounding dimensions', short: 'Dimensions', Icon: RulerIcon },
  { key: 'sectionPlane', label: 'Section plane', short: 'Section plane', Icon: SectionIcon },
  { key: 'caliper', label: '3D Caliper metrology', short: 'Caliper', Icon: CaliperIcon },
]

function patch<K extends keyof ViewerOptions>(
  { options, onChange }: ViewerControlProps,
  key: K,
  value: ViewerOptions[K],
) {
  onChange({ ...options, [key]: value })
}

export function ShadingControl({
  options,
  onChange,
  size = 'sm',
}: ViewerControlProps & { size?: 'sm' | 'md' }) {
  return (
    <SegmentedControl
      label="Surface shading"
      size={size}
      value={options.shadingMode}
      onChange={(shadingMode) =>
        patch({ options, onChange }, 'shadingMode', shadingMode as ShadingMode)
      }
      segments={[
        { value: 'metallic', label: 'Alloy', title: 'Machined metallic alloy' },
        { value: 'clay', label: 'Clay', title: 'Matte inspection clay' },
        { value: 'blueprint', label: 'Draft', title: 'Semi-transparent blueprint' },
        { value: 'normals', label: 'Normals', title: 'Vector orientation map' },
        {
          value: 'zebra',
          label: 'Zebra',
          title: 'Curvature zebra striping (G0/G1/G2 continuity)',
        },
      ]}
    />
  )
}

/** The on/off display switches: icon-only in a strip, or labelled in a grid. */
export function ViewToggles({
  options,
  onChange,
  labelled = false,
}: ViewerControlProps & { labelled?: boolean }) {
  if (labelled) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {TOGGLES.map(({ key, short, Icon }) => {
          const pressed = options[key]
          return (
            <button
              key={key}
              type="button"
              aria-pressed={pressed}
              onClick={() => patch({ options, onChange }, key, !pressed)}
              className={[
                'inline-flex h-11 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors',
                pressed
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-line bg-raised text-ink-muted hover:border-line-strong hover:text-ink',
              ].join(' ')}
            >
              <Icon className="size-4 shrink-0" />
              {short}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {TOGGLES.map(({ key, label, Icon }) => (
        <ToggleButton
          key={key}
          label={label}
          pressed={options[key]}
          onToggle={(pressed) => patch({ options, onChange }, key, pressed)}
        >
          <Icon />
        </ToggleButton>
      ))}
    </div>
  )
}

/** Axis and offset of the section plane, inline in a strip or stacked in a sheet. */
export function SectionControls({
  options,
  onChange,
  layout = 'inline',
}: ViewerControlProps & { layout?: 'inline' | 'stacked' }) {
  const stacked = layout === 'stacked'
  return (
    <div
      className={
        stacked
          ? 'space-y-3'
          : 'flex items-center gap-2 rounded-md border border-line bg-raised/80 px-2 py-1'
      }
    >
      {stacked ? null : (
        <span className="text-xs font-medium text-ink-muted">Cut:</span>
      )}
      <div className={stacked ? '' : 'w-24'}>
        <SegmentedControl
          label="Cut Axis"
          size={stacked ? 'md' : 'sm'}
          value={options.sectionAxis}
          onChange={(axis) => patch({ options, onChange }, 'sectionAxis', axis as SectionAxis)}
          segments={[
            { value: 'x', label: 'X', title: 'Cut along X plane' },
            { value: 'y', label: 'Y', title: 'Cut along Y plane' },
            { value: 'z', label: 'Z', title: 'Cut along Z plane' },
          ]}
        />
      </div>
      <div className={stacked ? 'flex items-center gap-3' : 'flex items-center gap-1.5'}>
        <input
          type="range"
          min="-0.95"
          max="0.95"
          step="0.05"
          value={options.sectionOffset}
          onChange={(event) =>
            patch({ options, onChange }, 'sectionOffset', parseFloat(event.target.value))
          }
          aria-label="Section cutting plane offset"
          aria-valuemin={-0.95}
          aria-valuemax={0.95}
          aria-valuenow={options.sectionOffset}
          className={
            stacked
              ? 'h-11 min-w-0 flex-1 cursor-pointer accent-accent'
              : 'h-1.5 w-16 cursor-pointer appearance-none rounded bg-line accent-accent'
          }
          title="Adjust cutting plane position (double click to reset to 0.00)"
          onDoubleClick={() => patch({ options, onChange }, 'sectionOffset', 0.0)}
        />
        <span
          className="w-10 text-right font-mono text-xs tabular-nums text-ink-muted"
          title="Current cutting offset"
        >
          {(options.sectionOffset >= 0 ? '+' : '') + options.sectionOffset.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

export function CaliperHint({ verb = 'Click' }: { verb?: 'Click' | 'Tap' }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-400">
      <CaliperIcon className="size-3.5" />
      <span>{verb} 2 vertices</span>
    </div>
  )
}

interface OrientationPresetsProps {
  active: ViewOrientation
  onSelect: (orientation: ViewOrientation) => void
  disabled: boolean
  size?: 'sm' | 'lg'
}

export function OrientationPresets({
  active,
  onSelect,
  disabled,
  size = 'sm',
}: OrientationPresetsProps) {
  return (
    <div
      role="group"
      aria-label="Camera orientation presets"
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
    >
      {(['iso', 'top', 'front', 'right'] as const).map((orient) => (
        <button
          key={orient}
          type="button"
          onClick={() => onSelect(orient)}
          disabled={disabled}
          aria-pressed={active === orient}
          aria-label={`Snap camera to ${orient.toUpperCase()} view`}
          title={`Snap camera to ${orient.toUpperCase()} view`}
          className={[
            size === 'lg'
              ? 'h-11 min-w-11 px-1.5 text-xs'
              : 'h-6 px-1.5 text-xs pointer-coarse:h-11 pointer-coarse:min-w-11 pointer-coarse:px-2',
            'rounded font-medium uppercase transition-colors',
            active === orient
              ? 'bg-raised text-accent'
              : 'text-ink-muted hover:text-ink disabled:opacity-40',
          ].join(' ')}
        >
          {orient}
        </button>
      ))}
    </div>
  )
}

export function ProjectionControl({
  options,
  onChange,
  size = 'sm',
}: ViewerControlProps & { size?: 'sm' | 'md' }) {
  const roomy = size === 'md'
  return (
    <SegmentedControl
      label="Camera projection"
      size={size}
      value={options.projection}
      onChange={(projection) => patch({ options, onChange }, 'projection', projection)}
      segments={[
        {
          value: 'perspective',
          label: roomy ? 'Perspective' : 'Persp',
          title: 'Perspective projection, for reading depth',
        },
        {
          value: 'orthographic',
          label: roomy ? 'Orthographic' : 'Ortho',
          title: 'Orthographic projection, for comparing dimensions',
        },
      ]}
    />
  )
}

export function FitButton({
  onClick,
  disabled,
  size = 'sm',
}: {
  onClick: () => void
  disabled: boolean
  size?: 'sm' | 'lg'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Fit camera to geometry bounds"
      title="Refit the camera to the part"
      className={[
        size === 'lg'
          ? 'size-11 shrink-0 justify-center'
          : 'h-7 gap-1.5 px-2 text-xs pointer-coarse:h-11 pointer-coarse:px-3',
        'inline-flex items-center rounded-md border border-line bg-raised text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40',
      ].join(' ')}
    >
      <ResetIcon className={size === 'lg' ? 'size-4' : 'size-3.5'} />
      {size === 'lg' ? null : 'Fit'}
    </button>
  )
}
