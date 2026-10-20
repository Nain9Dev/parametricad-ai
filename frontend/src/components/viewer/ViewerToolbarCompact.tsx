import { useState } from 'react'

import { SlidersIcon } from '@/components/ui/Icons'
import { FitButton, OrientationPresets } from '@/components/viewer/ViewerControls'
import type { ViewerToolbarProps } from '@/components/viewer/ViewerToolbar'
import { ViewOptionsSheet } from '@/components/viewer/ViewOptionsSheet'

/**
 * The toolbar for a narrow screen: the camera presets and Fit stay one tap
 * away, and everything else (shading, display switches, section plane,
 * projection) lives in a sheet opened by View.
 */
export function ViewerToolbarCompact({
  options,
  onChange,
  onResetView,
  activeOrientation = 'iso',
  onSelectOrientation,
  disabled,
}: ViewerToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {onSelectOrientation ? (
          <OrientationPresets
            active={activeOrientation}
            onSelect={onSelectOrientation}
            disabled={disabled}
            size="lg"
          />
        ) : null}

        <FitButton onClick={onResetView} disabled={disabled} size="lg" />

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-label="View options"
          className="ml-auto inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md border border-line bg-raised px-3 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <SlidersIcon className="size-4" />
          {/* Four presets, Fit and a labelled View need about 330 px; below 360 px
              the button keeps its icon and gives up the word. */}
          <span className="hidden min-[22.5rem]:inline">View</span>
        </button>
      </div>

      <ViewOptionsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        options={options}
        onChange={onChange}
      />
    </>
  )
}
