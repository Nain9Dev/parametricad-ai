import type { ViewOrientation } from '@/components/viewer/viewDirections'
import {
  CaliperHint,
  FitButton,
  OrientationPresets,
  ProjectionControl,
  SectionControls,
  ShadingControl,
  ViewToggles,
} from '@/components/viewer/ViewerControls'
import type { ViewerOptions } from '@/components/viewer/viewerOptions'

export interface ViewerToolbarProps {
  options: ViewerOptions
  onChange: (options: ViewerOptions) => void
  onResetView: () => void
  activeOrientation?: ViewOrientation
  onSelectOrientation?: (orientation: ViewOrientation) => void
  disabled: boolean
}

/** The full toolbar, one strip, for a screen with room for all of it. */
export function ViewerToolbar({
  options,
  onChange,
  onResetView,
  activeOrientation = 'iso',
  onSelectOrientation,
  disabled,
}: ViewerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-68">
        <ShadingControl options={options} onChange={onChange} />
      </div>

      <ViewToggles options={options} onChange={onChange} />

      {options.sectionPlane ? <SectionControls options={options} onChange={onChange} /> : null}

      {options.caliper ? <CaliperHint /> : null}

      <div className="flex items-center gap-1.5">
        {onSelectOrientation ? (
          <OrientationPresets
            active={activeOrientation}
            onSelect={onSelectOrientation}
            disabled={disabled}
          />
        ) : null}

        <div className="w-36">
          <ProjectionControl options={options} onChange={onChange} />
        </div>

        <FitButton onClick={onResetView} disabled={disabled} />
      </div>
    </div>
  )
}
