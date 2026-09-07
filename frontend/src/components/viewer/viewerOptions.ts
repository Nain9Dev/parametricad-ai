import type { Projection } from '@/components/viewer/CameraRig'

/** Inspection state for the 3D view, owned by the application shell. */
export interface ViewerOptions {
  wireframe: boolean
  grid: boolean
  axes: boolean
  dimensions: boolean
  projection: Projection
}

export const DEFAULT_VIEWER_OPTIONS: ViewerOptions = {
  wireframe: false,
  grid: true,
  axes: true,
  // Off by default: the labels are precise but they clutter a first look, and
  // an engineer reaches for them deliberately.
  dimensions: false,
  projection: 'perspective',
}
