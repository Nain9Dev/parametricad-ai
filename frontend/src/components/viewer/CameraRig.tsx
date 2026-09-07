import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import type { Box3 } from 'three'
import { MathUtils, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export type Projection = 'perspective' | 'orthographic'

interface CameraRigProps {
  bounds: Box3 | null
  projection: Projection
  /** Bumping this refits the view without changing the model. */
  fitToken: number
}

const FIELD_OF_VIEW = 40
/** Leaves a margin around the part instead of pressing it against the edges. */
const FRAMING_MARGIN = 1.45
/** A three-quarter view: the standard CAD read of a solid. */
const VIEW_DIRECTION = new Vector3(1, 0.75, 1).normalize()

/**
 * Camera, controls and framing.
 *
 * Both cameras are mounted and `makeDefault` decides which one drives the
 * scene, so switching projection keeps the orbit state rather than resetting
 * the view. Near and far planes are derived from the part: these models span
 * millimetres to metres, and a fixed frustum either clips a beam or destroys
 * depth precision on a washer.
 */
export function CameraRig({ bounds, projection, fitToken }: CameraRigProps) {
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const lastFitted = useRef<string>('')

  useEffect(() => {
    if (!bounds || bounds.isEmpty() || !controls) return

    const center = bounds.getCenter(new Vector3())
    const extent = bounds.getSize(new Vector3())
    const radius = Math.max(extent.length() / 2, 1e-3)

    // Refit only when something about the framing actually changed; otherwise
    // every render would yank the camera back from wherever the user orbited.
    const signature = `${projection}:${fitToken}:${center.toArray().join()}:${radius}`
    if (lastFitted.current === signature) return
    lastFitted.current = signature

    const distance = (radius * FRAMING_MARGIN) / Math.sin(MathUtils.degToRad(FIELD_OF_VIEW / 2))
    camera.position.copy(center).addScaledVector(VIEW_DIRECTION, distance)
    camera.near = Math.max(distance - radius * 4, radius / 1000)
    camera.far = distance + radius * 12

    if ('isOrthographicCamera' in camera && camera.isOrthographicCamera) {
      const smallestViewport = Math.min(size.width, size.height)
      camera.zoom = smallestViewport / (2 * radius * FRAMING_MARGIN)
      camera.near = -radius * 12
      camera.far = radius * 12
    }

    camera.updateProjectionMatrix()
    controls.target.copy(center)
    controls.update()
    invalidate()
  }, [bounds, projection, fitToken, camera, controls, size, invalidate])

  return (
    <>
      <PerspectiveCamera
        makeDefault={projection === 'perspective'}
        fov={FIELD_OF_VIEW}
        position={[120, 90, 120]}
      />
      <OrthographicCamera
        makeDefault={projection === 'orthographic'}
        position={[120, 90, 120]}
        zoom={1}
      />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        // Zooming to the pointer is what every CAD viewer does, and it is the
        // difference between inspecting a bolt hole and hunting for it.
        zoomToCursor
        maxPolarAngle={Math.PI}
        // Anything below a millimetre of separation is beyond what these parts
        // are modelled to, and lets the near plane collapse.
        minDistance={0.5}
      />
    </>
  )
}
