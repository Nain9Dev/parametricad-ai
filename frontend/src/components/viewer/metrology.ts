import { Box3, Vector3 } from 'three'
import type { SectionAxis } from '@/components/viewer/viewerOptions'

export interface Measurement {
  distance: number
  midpoint: Vector3
  delta: { dx: number; dy: number; dz: number }
}

/** Returns the triangle corner closest to `point`; the first corner wins ties. */
export function nearestVertex(point: Vector3, corners: readonly [Vector3, Vector3, Vector3]): Vector3 {
  let closest = corners[0]
  let minDist = point.distanceTo(closest)
  for (const corner of corners) {
    const dist = point.distanceTo(corner)
    if (dist < minDist) {
      closest = corner
      minDist = dist
    }
  }
  return closest
}

export function measure(a: Vector3, b: Vector3): Measurement {
  return {
    distance: a.distanceTo(b),
    midpoint: new Vector3().addVectors(a, b).multiplyScalar(0.5),
    delta: { dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y), dz: Math.abs(b.z - a.z) },
  }
}

export interface SectionPlaneLayout {
  center: Vector3
  size: { width: number; height: number }
  rotation: [number, number, number]
}

/**
 * Places the guide plane for a section cut. `offset` is normalised to [-1, 1]
 * across the half extent of the bounds along `axis`.
 */
export function sectionPlaneLayout(bounds: Box3, axis: SectionAxis, offset: number): SectionPlaneLayout {
  const mid = bounds.getCenter(new Vector3())
  const extent = bounds.getSize(new Vector3())
  const pad = Math.max(extent.length() * 0.1, 2.0)

  if (axis === 'x') {
    return {
      center: new Vector3(mid.x + (offset * extent.x) / 2, mid.y, mid.z),
      size: { width: extent.z + pad, height: extent.y + pad },
      rotation: [0, Math.PI / 2, 0],
    }
  }
  if (axis === 'y') {
    return {
      center: new Vector3(mid.x, mid.y + (offset * extent.y) / 2, mid.z),
      size: { width: extent.x + pad, height: extent.z + pad },
      rotation: [Math.PI / 2, 0, 0],
    }
  }
  return {
    center: new Vector3(mid.x, mid.y, mid.z + (offset * extent.z) / 2),
    size: { width: extent.x + pad, height: extent.y + pad },
    rotation: [0, 0, 0],
  }
}
