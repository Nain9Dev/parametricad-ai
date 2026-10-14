import { useMemo } from 'react'
import { DoubleSide, Vector3 } from 'three'
import type { Box3 } from 'three'
import type { SectionAxis } from '@/components/viewer/viewerOptions'

interface SectionPlaneHelperProps {
  bounds: Box3
  axis: SectionAxis
  offset: number
}

/**
 * Visual guide plane showing the active clipping plane position.
 */
export function SectionPlaneHelper({ bounds, axis, offset }: SectionPlaneHelperProps) {
  const { center, size, rotation } = useMemo(() => {
    const mid = bounds.getCenter(new Vector3())
    const extent = bounds.getSize(new Vector3())

    let planeCenter = new Vector3()
    let planeSize = { width: 1, height: 1 }
    let planeRot: [number, number, number] = [0, 0, 0]

    const pad = Math.max(extent.length() * 0.1, 2.0)

    if (axis === 'x') {
      const x = mid.x + (offset * extent.x) / 2
      planeCenter = new Vector3(x, mid.y, mid.z)
      planeSize = { width: extent.z + pad, height: extent.y + pad }
      planeRot = [0, Math.PI / 2, 0]
    } else if (axis === 'y') {
      const y = mid.y + (offset * extent.y) / 2
      planeCenter = new Vector3(mid.x, y, mid.z)
      planeSize = { width: extent.x + pad, height: extent.z + pad }
      planeRot = [Math.PI / 2, 0, 0]
    } else {
      const z = mid.z + (offset * extent.z) / 2
      planeCenter = new Vector3(mid.x, mid.y, z)
      planeSize = { width: extent.x + pad, height: extent.y + pad }
      planeRot = [0, 0, 0]
    }

    return { center: planeCenter, size: planeSize, rotation: planeRot }
  }, [bounds, axis, offset])

  return (
    <mesh position={center} rotation={rotation}>
      <planeGeometry args={[size.width, size.height]} />
      <meshBasicMaterial
        color="#38bdf8"
        transparent
        opacity={0.18}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
