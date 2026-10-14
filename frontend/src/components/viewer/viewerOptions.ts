import type { Projection } from '@/components/viewer/CameraRig'

export type SectionAxis = 'x' | 'y' | 'z'

/** Inspection state for the 3D view, owned by the application shell. */
export interface ViewerOptions {
  wireframe: boolean
  grid: boolean
  axes: boolean
  dimensions: boolean
  projection: Projection
  sectionPlane: boolean
  sectionAxis: SectionAxis
  sectionOffset: number
  caliper: boolean
}

export const DEFAULT_VIEWER_OPTIONS: ViewerOptions = {
  wireframe: false,
  grid: true,
  axes: true,
  dimensions: false,
  projection: 'perspective',
  sectionPlane: false,
  sectionAxis: 'z',
  sectionOffset: 0.0,
  caliper: false,
}
