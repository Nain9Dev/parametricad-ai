import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ToggleButton } from '@/components/ui/ToggleButton'
import {
  AxesIcon,
  CaliperIcon,
  GridIcon,
  ResetIcon,
  RulerIcon,
  SectionIcon,
  WireframeIcon,
} from '@/components/ui/Icons'
import type { SectionAxis, ViewerOptions } from '@/components/viewer/viewerOptions'

interface ViewerToolbarProps {
  options: ViewerOptions
  onChange: (options: ViewerOptions) => void
  onResetView: () => void
  disabled: boolean
}

export function ViewerToolbar({
  options,
  onChange,
  onResetView,
  disabled,
}: ViewerToolbarProps) {
  function set<K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K]) {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
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
          <input
            type="range"
            min="-0.95"
            max="0.95"
            step="0.05"
            value={options.sectionOffset}
            onChange={(e) => set('sectionOffset', parseFloat(e.target.value))}
            className="h-1.5 w-16 cursor-pointer appearance-none rounded bg-line accent-accent"
            title="Adjust cutting plane position"
          />
        </div>
      )}

      {options.caliper && (
        <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.6875rem] text-amber-400">
          <CaliperIcon className="size-3.5" />
          <span>Click 2 vertices</span>
        </div>
      )}

      <div className="w-44">
        <SegmentedControl
          label="Camera projection"
          size="sm"
          value={options.projection}
          onChange={(projection) => set('projection', projection)}
          segments={[
            {
              value: 'perspective',
              label: 'Perspective',
              title: 'Perspective projection, for reading depth',
            },
            {
              value: 'orthographic',
              label: 'Orthographic',
              title: 'Orthographic projection, for comparing dimensions',
            },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={onResetView}
        disabled={disabled}
        title="Refit the camera to the part"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-raised px-2 text-[0.6875rem] text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
      >
        <ResetIcon className="size-3.5" />
        Fit view
      </button>
    </div>
  )
}
