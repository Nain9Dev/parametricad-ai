import { useMemo } from 'react'
import { DoubleSide } from 'three'
import type { Box3 } from 'three'
import { sectionPlaneLayout } from '@/components/viewer/metrology'
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
  const { center, size, rotation } = useMemo(() => sectionPlaneLayout(bounds, axis, offset), [bounds, axis, offset])

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
