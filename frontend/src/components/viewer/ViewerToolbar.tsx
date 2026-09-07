import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ToggleButton } from '@/components/ui/ToggleButton'
import { AxesIcon, GridIcon, ResetIcon, RulerIcon, WireframeIcon } from '@/components/ui/Icons'
import type { ViewerOptions } from '@/components/viewer/viewerOptions'

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
      </div>

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
