import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { Box3 } from 'three'
import { BoxGeometry, EdgesGeometry, Vector3 } from 'three'

interface DimensionOverlayProps {
  bounds: Box3
}

/**
 * The bounding box, with its three extents labelled.
 *
 * The point is not decoration: reading a dimension off an orbiting solid is
 * guesswork, and this turns "looks about right" into a number the engineer can
 * check against the parameter they typed.
 */
export function DimensionOverlay({ bounds }: DimensionOverlayProps) {
  const { edges, center, size, labels } = useMemo(() => {
    const extent = bounds.getSize(new Vector3())
    const middle = bounds.getCenter(new Vector3())
    const box = new BoxGeometry(
      Math.max(extent.x, 1e-6),
      Math.max(extent.y, 1e-6),
      Math.max(extent.z, 1e-6),
    )
    const outline = new EdgesGeometry(box)
    box.dispose()

    // Each label sits at the midpoint of one edge of the box, pushed just
    // outside the surface so it is not buried in the solid.
    const offset = Math.max(extent.length() * 0.04, 0.5)
    return {
      edges: outline,
      center: middle,
      size: extent,
      labels: [
        {
          axis: 'X',
          value: extent.x,
          position: new Vector3(
            middle.x,
            bounds.min.y - offset,
            bounds.max.z + offset,
          ),
        },
        {
          axis: 'Y',
          value: extent.y,
          position: new Vector3(
            bounds.max.x + offset,
            middle.y,
            bounds.max.z + offset,
          ),
        },
        {
          axis: 'Z',
          value: extent.z,
          position: new Vector3(
            bounds.max.x + offset,
            bounds.min.y - offset,
            middle.z,
          ),
        },
      ],
    }
  }, [bounds])

  return (
    <group>
      <lineSegments geometry={edges} position={center}>
        <lineBasicMaterial color="#3d8bfd" transparent opacity={0.55} />
      </lineSegments>

      {labels.map((label) => (
        <Html
          key={label.axis}
          position={label.position}
          center
          // Labels are an overlay on the scene, not part of it: they must stay
          // readable from any angle and must never swallow an orbit drag.
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="numeric rounded border border-accent/35 bg-void/85 px-1.5 py-0.5 text-[0.625rem] whitespace-nowrap text-accent">
            {label.axis} {label.value.toFixed(2)} mm
          </span>
        </Html>
      ))}

      <Html
        position={[center.x, bounds.max.y + Math.max(size.length() * 0.06, 1), center.z]}
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className="numeric rounded border border-line-strong bg-void/85 px-1.5 py-0.5 text-[0.625rem] whitespace-nowrap text-ink-muted">
          {size.x.toFixed(1)} x {size.y.toFixed(1)} x {size.z.toFixed(1)} mm
        </span>
      </Html>
    </group>
  )
}
