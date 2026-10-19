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
import type { ViewOrientation } from '@/components/viewer/CameraRig'
import type { SectionAxis, ShadingMode, ViewerOptions } from '@/components/viewer/viewerOptions'

interface ViewerToolbarProps {
  options: ViewerOptions
  onChange: (options: ViewerOptions) => void
  onResetView: () => void
  activeOrientation?: ViewOrientation
  onSelectOrientation?: (orientation: ViewOrientation) => void
  disabled: boolean
}

export function ViewerToolbar({
  options,
  onChange,
  onResetView,
  activeOrientation = 'iso',
  onSelectOrientation,
  disabled,
}: ViewerToolbarProps) {
  function set<K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K]) {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-68">
        <SegmentedControl
          label="Surface shading"
          size="sm"
          value={options.shadingMode}
          onChange={(shadingMode) => set('shadingMode', shadingMode as ShadingMode)}
          segments={[
            { value: 'metallic', label: 'Alloy', title: 'Machined metallic alloy' },
            { value: 'clay', label: 'Clay', title: 'Matte inspection clay' },
            { value: 'blueprint', label: 'Draft', title: 'Semi-transparent blueprint' },
            { value: 'normals', label: 'Normals', title: 'Vector orientation map' },
            { value: 'zebra', label: 'Zebra', title: 'Curvature zebra striping (G0/G1/G2 continuity)' },
          ]}
        />
      </div>

      <div className="flex items-center gap-1">
        <ToggleButton
          label="Feature crease edges"
          pressed={options.edges}
          onToggle={(pressed) => set('edges', pressed)}
        >
          <EdgesIcon />
        </ToggleButton>
        <ToggleButton
          label="Wireframe shading"
          pressed={options.wireframe}
          onToggle={(pressed) => set('wireframe', pressed)}
        >
          <WireframeIcon />
        </ToggleButton>
        <ToggleButton
          label="Ground grid"
          pressed={options.grid}
          onToggle={(pressed) => set('grid', pressed)}
        >
          <GridIcon />
        </ToggleButton>
        <ToggleButton
          label="Axis gizmo"
          pressed={options.axes}
          onToggle={(pressed) => set('axes', pressed)}
        >
          <AxesIcon />
        </ToggleButton>
        <ToggleButton
          label="Bounding dimensions"
          pressed={options.dimensions}
          onToggle={(pressed) => set('dimensions', pressed)}
        >
          <RulerIcon />
        </ToggleButton>
        <ToggleButton
          label="Section plane"
          pressed={options.sectionPlane}
          onToggle={(pressed) => set('sectionPlane', pressed)}
        >
          <SectionIcon />
        </ToggleButton>
        <ToggleButton
          label="3D Caliper metrology"
          pressed={options.caliper}
          onToggle={(pressed) => set('caliper', pressed)}
        >
          <CaliperIcon />
        </ToggleButton>
      </div>

      {options.sectionPlane && (
        <div className="flex items-center gap-2 rounded-md border border-line bg-raised/80 px-2 py-1">
          <span className="text-[0.625rem] font-medium text-ink-muted">Cut:</span>
          <div className="w-24">
            <SegmentedControl
              label="Cut Axis"
              size="sm"
              value={options.sectionAxis}
              onChange={(axis) => set('sectionAxis', axis as SectionAxis)}
              segments={[
                { value: 'x', label: 'X', title: 'Cut along X plane' },
                { value: 'y', label: 'Y', title: 'Cut along Y plane' },
                { value: 'z', label: 'Z', title: 'Cut along Z plane' },
              ]}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="-0.95"
              max="0.95"
              step="0.05"
              value={options.sectionOffset}
              onChange={(e) => set('sectionOffset', parseFloat(e.target.value))}
              aria-label="Section cutting plane offset"
              aria-valuemin={-0.95}
              aria-valuemax={0.95}
              aria-valuenow={options.sectionOffset}
              className="h-1.5 w-16 cursor-pointer appearance-none rounded bg-line accent-accent"
              title="Adjust cutting plane position (double click to reset to 0.00)"
              onDoubleClick={() => set('sectionOffset', 0.0)}
            />
            <span
              className="w-10 text-right font-mono text-[0.625rem] tabular-nums text-ink-muted"
              title="Current cutting offset"
            >
              {(options.sectionOffset >= 0 ? '+' : '') + options.sectionOffset.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {options.caliper && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.6875rem] text-amber-400">
          <CaliperIcon className="size-3.5" />
          <span>Click 2 vertices</span>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {onSelectOrientation && (
          <div
            role="group"
            aria-label="Camera orientation presets"
            className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
          >
            {(['iso', 'top', 'front', 'right'] as const).map((orient) => (
              <button
                key={orient}
                type="button"
                onClick={() => onSelectOrientation(orient)}
                disabled={disabled}
                aria-pressed={activeOrientation === orient}
                aria-label={`Snap camera to ${orient.toUpperCase()} view`}
                title={`Snap camera to ${orient.toUpperCase()} view`}
                className={`h-6 rounded px-1.5 text-[0.625rem] font-medium uppercase transition-colors ${
                  activeOrientation === orient
                    ? 'bg-raised text-accent'
                    : 'text-ink-muted hover:text-ink disabled:opacity-40'
                }`}
              >
                {orient}
              </button>
            ))}
          </div>
        )}

        <div className="w-36">
          <SegmentedControl
            label="Camera projection"
            size="sm"
            value={options.projection}
            onChange={(projection) => set('projection', projection)}
            segments={[
              {
                value: 'perspective',
                label: 'Persp',
                title: 'Perspective projection, for reading depth',
              },
              {
                value: 'orthographic',
                label: 'Ortho',
                title: 'Orthographic projection, for comparing dimensions',
              },
            ]}
          />
        </div>

        <button
          type="button"
          onClick={onResetView}
          disabled={disabled}
          aria-label="Fit camera to geometry bounds"
          title="Refit the camera to the part"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-raised px-2 text-[0.6875rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          <ResetIcon className="size-3.5" />
          Fit
        </button>
      </div>
    </div>
  )
}

