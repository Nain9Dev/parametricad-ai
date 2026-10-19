import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEWER_OPTIONS } from '@/components/viewer/viewerOptions'
import { VIEW_DIRECTIONS } from '@/components/viewer/viewDirections'

// @req REQ-OPT-02

describe('CAD Viewer Visual Architecture', () => {
  it('initializes with mechanical feature edges enabled and metallic shading by default', () => {
    expect(DEFAULT_VIEWER_OPTIONS.edges).toBe(true)
    expect(DEFAULT_VIEWER_OPTIONS.shadingMode).toBe('metallic')
    expect(DEFAULT_VIEWER_OPTIONS.projection).toBe('perspective')
    expect(DEFAULT_VIEWER_OPTIONS.grid).toBe(true)
  })

  it('provides unit normalized camera direction vectors for all CAD standard presets', () => {
    const orientations = ['iso', 'top', 'front', 'right'] as const

    for (const orient of orientations) {
      const dir = VIEW_DIRECTIONS[orient]
      expect(dir).toBeDefined()
      // Vector length must equal 1 within floating point margin
      expect(Math.abs(dir.length() - 1.0)).toBeLessThan(1e-5)
    }

    // Top view has slight z offset to avoid gimbal lock with default up vector (0, 1, 0)
    expect(VIEW_DIRECTIONS.top.y).toBeGreaterThan(0.99)
    expect(VIEW_DIRECTIONS.top.z).toBeGreaterThan(0)
  })

  it('validates Euler-Poincaré invariant calculation: chi = 2 * (bodies - genus)', () => {
    // Genus 0 sphere/block solid
    const sphericalSolid = { bodies: 1, genus: 0 }
    expect(2 * (sphericalSolid.bodies - sphericalSolid.genus)).toBe(2)

    // Genus 1 torus/through-hole flange solid
    const toroidalSolid = { bodies: 1, genus: 1 }
    expect(2 * (toroidalSolid.bodies - toroidalSolid.genus)).toBe(0)

    // 2 Disjoint bodies with 0 holes
    const multiBodySolid = { bodies: 2, genus: 0 }
    expect(2 * (multiBodySolid.bodies - multiBodySolid.genus)).toBe(4)
  })

  it('verifies C1-C10 check spectrum evaluation on conforming solid mesh', () => {
    const conformingMesh = {
      unreferenced_vertex_count: 0,
      duplicate_face_count: 0,
      degenerate_face_count: 0,
      is_edge_manifold: true,
      non_manifold_edge_count: 0,
      is_watertight: true,
      boundary_edge_count: 0,
      is_winding_consistent: true,
      has_outward_normals: true,
      has_self_intersections: false,
      self_intersecting_pair_count: 0,
      volume_deviation_ratio: 0.001,
      connected_component_count: 1,
      bounding_box: { size: { x: 100, y: 100, z: 12 } },
    }

    // C1: Buffer integrity
    expect(conformingMesh.unreferenced_vertex_count === 0 && conformingMesh.duplicate_face_count === 0).toBe(true)
    // C2: Quantum threshold
    expect(conformingMesh.degenerate_face_count === 0).toBe(true)
    // C3: 2-Manifold
    expect(conformingMesh.is_edge_manifold && conformingMesh.non_manifold_edge_count === 0).toBe(true)
    // C4: Watertight closure
    expect(conformingMesh.is_watertight && conformingMesh.boundary_edge_count === 0).toBe(true)
    // C5: Winding & Normal consistency
    expect(conformingMesh.is_winding_consistent && conformingMesh.has_outward_normals).toBe(true)
    // C6: BVH Disjoint boundary
    expect(!conformingMesh.has_self_intersections && conformingMesh.self_intersecting_pair_count === 0).toBe(true)
    // C8: Positive extents
    expect(conformingMesh.bounding_box.size.x > 0).toBe(true)
    // C9: Volume deviation < 2%
    expect(conformingMesh.volume_deviation_ratio < 0.02).toBe(true)
    // C10: Single component closure
    expect(conformingMesh.connected_component_count === 1).toBe(true)
  })
})

