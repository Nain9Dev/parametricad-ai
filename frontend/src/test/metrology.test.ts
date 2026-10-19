import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import { measure, nearestVertex, sectionPlaneLayout } from '@/components/viewer/metrology'

// @req REQ-OPT-03

describe('caliper metrology', () => {
  it('snaps to the triangle corner nearest to the hit point', () => {
    const corners = [new Vector3(0, 0, 0), new Vector3(10, 0, 0), new Vector3(0, 10, 0)] as const
    expect(nearestVertex(new Vector3(9, 1, 0), corners)).toBe(corners[1])
    expect(nearestVertex(new Vector3(1, 8, 0), corners)).toBe(corners[2])
  })

  it('keeps the first corner on an exact tie', () => {
    const corners = [new Vector3(-1, 0, 0), new Vector3(1, 0, 0), new Vector3(0, 5, 0)] as const
    expect(nearestVertex(new Vector3(0, 0, 0), corners)).toBe(corners[0])
  })

  it('measures distance, midpoint and absolute axis deltas', () => {
    const result = measure(new Vector3(1, 2, 3), new Vector3(4, 6, 15))
    expect(result.distance).toBeCloseTo(13, 10)
    expect(result.midpoint.toArray()).toEqual([2.5, 4, 9])
    expect(result.delta).toEqual({ dx: 3, dy: 4, dz: 12 })
  })

  it('reports the same measurement regardless of point order', () => {
    const a = new Vector3(-5, 2, 0)
    const b = new Vector3(5, -2, 7)
    expect(measure(a, b).delta).toEqual(measure(b, a).delta)
    expect(measure(a, b).distance).toBe(measure(b, a).distance)
  })
})

// @req REQ-OPT-02

describe('section plane layout', () => {
  const bounds = new Box3(new Vector3(0, 0, 0), new Vector3(20, 10, 40))

  it('centres the plane on the bounds at zero offset', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(sectionPlaneLayout(bounds, axis, 0).center.toArray()).toEqual([10, 5, 20])
    }
  })

  it('moves along the cut axis by half the extent per unit offset', () => {
    expect(sectionPlaneLayout(bounds, 'x', 1).center.x).toBe(20)
    expect(sectionPlaneLayout(bounds, 'y', -1).center.y).toBe(0)
    expect(sectionPlaneLayout(bounds, 'z', 0.5).center.z).toBe(30)
  })

  it('spans the two other axes with padding and orients normal to the cut axis', () => {
    const pad = Math.max(bounds.getSize(new Vector3()).length() * 0.1, 2)
    expect(sectionPlaneLayout(bounds, 'x', 0).size).toEqual({ width: 40 + pad, height: 10 + pad })
    expect(sectionPlaneLayout(bounds, 'y', 0).rotation).toEqual([Math.PI / 2, 0, 0])
    expect(sectionPlaneLayout(bounds, 'z', 0).rotation).toEqual([0, 0, 0])
  })

  it('pads degenerate bounds so the guide stays visible', () => {
    const flat = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0))
    expect(sectionPlaneLayout(flat, 'z', 0).size).toEqual({ width: 2, height: 2 })
  })
})
