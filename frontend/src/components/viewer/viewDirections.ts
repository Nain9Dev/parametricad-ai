import { Vector3 } from 'three'

export type ViewOrientation = 'iso' | 'top' | 'front' | 'right'

/** Standard CAD view orientation vectors. */
export const VIEW_DIRECTIONS: Record<ViewOrientation, Vector3> = {
  iso: new Vector3(1, 0.75, 1).normalize(),
  top: new Vector3(0, 1, 0.0001).normalize(),
  front: new Vector3(0, 0, 1).normalize(),
  right: new Vector3(1, 0, 0).normalize(),
}
