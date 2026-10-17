import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  EdgesGeometry,
  EquirectangularReflectionMapping,
  FrontSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshNormalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
} from 'three'
import type { Group, Plane } from 'three'
import type { ShadingMode } from '@/components/viewer/viewerOptions'

let cachedZebraTexture: CanvasTexture | null = null

function getZebraTexture(): CanvasTexture {
  if (cachedZebraTexture) return cachedZebraTexture

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const stripes = 32
    const stripeHeight = 512 / stripes
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0b0f17' : '#ffffff'
      ctx.fillRect(0, i * stripeHeight, 512, stripeHeight)
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  cachedZebraTexture = texture
  return texture
}

interface ModelObjectProps {
  object: Group
  wireframe: boolean
  edges?: boolean
  shadingMode?: ShadingMode
  clippingPlanes?: Plane[]
}

/**
 * Renders a loaded model with customizable CAD surface shading and feature edge accentuation.
 *
 * Provides industrial metallic shading, matte clay inspection, blueprint technical
 * transparency, false-color normal vector evaluation, and zebra reflection striping
 * for surface continuity (G0/G1/G2) audits, complemented by crisp crease line overlays (24°).
 */
export function ModelObject({
  object,
  wireframe,
  edges = true,
  shadingMode = 'metallic',
  clippingPlanes,
}: ModelObjectProps) {
  const material = useMemo(() => {
    if (shadingMode === 'normals') {
      return new MeshNormalMaterial({
        side: FrontSide,
      })
    }

    if (shadingMode === 'zebra') {
      const envMap = getZebraTexture()
      return new MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.04,
        metalness: 0.96,
        envMap,
        side: FrontSide,
      })
    }

    let color = '#b8c2d0'
    let metalness = 0.62
    let roughness = 0.36
    let transparent = false
    let opacity = 1.0

    if (shadingMode === 'clay') {
      color = '#e2e8f0'
      metalness = 0.05
      roughness = 0.88
    } else if (shadingMode === 'blueprint') {
      color = '#0284c7'
      metalness = 0.1
      roughness = 0.25
      transparent = true
      opacity = 0.65
    }

    return new MeshStandardMaterial({
      color,
      metalness,
      roughness,
      transparent,
      opacity,
      side: FrontSide,
    })
  }, [shadingMode])

  const edgeColor = useMemo(() => {
    if (shadingMode === 'blueprint') return '#38bdf8'
    if (shadingMode === 'normals') return '#0f172a'
    if (shadingMode === 'clay') return '#475569'
    if (shadingMode === 'zebra') return '#ef4444'
    return '#1e293b'
  }, [shadingMode])

  const edgeMaterial = useMemo(
    () =>
      new LineBasicMaterial({
        color: edgeColor,
        linewidth: 1,
        transparent: shadingMode === 'blueprint',
        opacity: shadingMode === 'blueprint' ? 0.85 : 1,
      }),
    [edgeColor, shadingMode],
  )

  const linesRef = useRef<LineSegments[]>([])

  // Generate crisp feature crease edges (24° threshold) without triangulation artifacts
  useEffect(() => {
    const lines: LineSegments[] = []
    const createdEdges: { parent: Mesh; line: LineSegments; geom: EdgesGeometry }[] = []

    object.traverse((node) => {
      if (node instanceof Mesh && !(node instanceof LineSegments) && node.geometry) {
        try {
          const edgesGeom = new EdgesGeometry(node.geometry, 24)
          const line = new LineSegments(edgesGeom, edgeMaterial)
          line.renderOrder = 1
          line.visible = edges
          node.add(line)
          lines.push(line)
          createdEdges.push({ parent: node, line, geom: edgesGeom })
        } catch {
          // Skip if geometry type does not support edge calculation
        }
      }
    })

    linesRef.current = lines

    return () => {
      for (const item of createdEdges) {
        item.parent.remove(item.line)
        item.geom.dispose()
      }
      linesRef.current = []
    }
  }, [object, edgeMaterial])

  // Instant edge visibility toggle without recomputing geometry
  useEffect(() => {
    for (const line of linesRef.current) {
      line.visible = edges
    }
  }, [edges])

  useEffect(() => {
    const replaced: unknown[] = []
    object.traverse((node) => {
      if (!(node instanceof Mesh) || node instanceof LineSegments) return
      if (node.material && node.material !== material && node.material !== edgeMaterial) {
        replaced.push(node.material)
      }
      node.material = material
      node.castShadow = false
      node.receiveShadow = false
    })

    // The materials that came with the file are now unreferenced.
    for (const node of replaced) {
      const stale = node as { dispose?: () => void }
      stale.dispose?.()
    }
  }, [object, material, edgeMaterial])

  useEffect(() => {
    const planes = clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : null
    material.wireframe = wireframe
    material.clippingPlanes = planes
    material.clipShadows = true
    // When section plane or transparent blueprint is active, render DoubleSide for cavity inspection
    material.side =
      wireframe ||
      planes !== null ||
      shadingMode === 'blueprint' ||
      shadingMode === 'normals'
        ? DoubleSide
        : FrontSide
    material.needsUpdate = true

    edgeMaterial.clippingPlanes = planes
    edgeMaterial.needsUpdate = true
  }, [material, edgeMaterial, wireframe, clippingPlanes, shadingMode])

  // Disposing managed Three.js materials
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => edgeMaterial.dispose(), [edgeMaterial])

  return <primitive object={object} />
}

