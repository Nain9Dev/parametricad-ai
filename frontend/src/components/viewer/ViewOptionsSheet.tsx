import type { ReactNode } from 'react'

import { BottomSheet } from '@/components/ui/BottomSheet'
import {
  CaliperHint,
  ProjectionControl,
  SectionControls,
  ShadingControl,
  ViewToggles,
  type ViewerControlProps,
} from '@/components/viewer/ViewerControls'

interface ViewOptionsSheetProps extends ViewerControlProps {
  open: boolean
  onClose: () => void
}

/** Everything the compact toolbar has no room to keep on show. */
export function ViewOptionsSheet({ open, onClose, options, onChange }: ViewOptionsSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="View options">
      <div className="space-y-5 p-4">
        <SheetSection title="Shading">
          <ShadingControl options={options} onChange={onChange} size="md" />
        </SheetSection>

        <SheetSection title="Display">
          <ViewToggles options={options} onChange={onChange} labelled />
        </SheetSection>

        {options.sectionPlane ? (
          <SheetSection title="Section">
            <SectionControls options={options} onChange={onChange} layout="stacked" />
          </SheetSection>
        ) : null}

        {options.caliper ? <CaliperHint verb="Tap" /> : null}

        <SheetSection title="Projection">
          <ProjectionControl options={options} onChange={onChange} size="md" />
        </SheetSection>
      </div>
    </BottomSheet>
  )
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[0.6875rem] font-semibold tracking-wider text-ink-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}
