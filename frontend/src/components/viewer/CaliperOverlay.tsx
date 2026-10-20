import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BufferGeometry, Float32BufferAttribute, Mesh, Vector2, Vector3 } from 'three'
import type { Group } from 'three'
import { measure, nearestVertex } from '@/components/viewer/metrology'

interface CaliperOverlayProps {
  modelObject: Group | null
  enabled: boolean
}

/**
 * 3D Caliper measurement tool with vertex snapping.
 *
 * Click two vertices on the mesh to measure the exact physical distance and
 * coordinate delta in millimetres.
 */
export function CaliperOverlay({ modelObject, enabled }: CaliperOverlayProps) {
  const { gl, camera, raycaster } = useThree()
  const [hoverVertex, setHoverVertex] = useState<Vector3 | null>(null)
  const [pointA, setPointA] = useState<Vector3 | null>(null)
  const [pointB, setPointB] = useState<Vector3 | null>(null)

  // Reset points when caliper is disabled
  useEffect(() => {
    if (!enabled) {
      setHoverVertex(null)
      setPointA(null)
      setPointB(null)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !modelObject) return

    const dom = gl.domElement
    dom.style.cursor = 'crosshair'

    const handlePointerMove = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(new Vector2(x, y), camera)
      const meshes: Mesh[] = []
      modelObject.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child)
      })

      const intersects = raycaster.intersectObjects(meshes, false)
      if (intersects.length > 0) {
        const hit = intersects[0]
        if (hit && hit.face && hit.object instanceof Mesh) {
          const geom = hit.object.geometry
          const pos = geom.attributes.position
          if (pos) {
            const vA = new Vector3().fromBufferAttribute(pos, hit.face.a).applyMatrix4(hit.object.matrixWorld)
            const vB = new Vector3().fromBufferAttribute(pos, hit.face.b).applyMatrix4(hit.object.matrixWorld)
            const vC = new Vector3().fromBufferAttribute(pos, hit.face.c).applyMatrix4(hit.object.matrixWorld)

            setHoverVertex(nearestVertex(hit.point, [vA, vB, vC]))
            return
          }
        }
      }
      setHoverVertex(null)
    }

    const handleClick = () => {
      if (!hoverVertex) return

      if (!pointA) {
        setPointA(hoverVertex.clone())
      } else if (!pointB) {
        setPointB(hoverVertex.clone())
      } else {
        setPointA(hoverVertex.clone())
        setPointB(null)
      }
    }

    dom.addEventListener('mousemove', handlePointerMove)
    dom.addEventListener('click', handleClick)

    return () => {
      dom.style.cursor = 'auto'
      dom.removeEventListener('mousemove', handlePointerMove)
      dom.removeEventListener('click', handleClick)
    }
  }, [enabled, modelObject, camera, raycaster, gl, pointA, pointB, hoverVertex])

  const lineGeometry = useMemo(() => {
    if (!pointA || !pointB) return null
    const geom = new BufferGeometry()
    const points = [
      pointA.x, pointA.y, pointA.z,
      pointB.x, pointB.y, pointB.z,
    ]
    geom.setAttribute('position', new Float32BufferAttribute(points, 3))
    return geom
  }, [pointA, pointB])

  const measurement = useMemo(() => (pointA && pointB ? measure(pointA, pointB) : null), [pointA, pointB])

  if (!enabled) return null

  return (
    <group>
      {/* Snapping target marker */}
      {hoverVertex && !pointB && (
        <mesh position={hoverVertex}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      )}

      {/* Point A */}
      {pointA && (
        <mesh position={pointA}>
          <sphereGeometry args={[1.0, 16, 16]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}

      {/* Point B */}
      {pointB && (
        <mesh position={pointB}>
          <sphereGeometry args={[1.0, 16, 16]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}

      {/* Measurement line */}
      {lineGeometry && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial color="#f59e0b" linewidth={2} />
        </lineSegments>
      )}

      {/* Caliper Measurement Tag */}
      {measurement && (
        <Html position={measurement.midpoint} center zIndexRange={[30, 0]} style={{ pointerEvents: 'auto' }}>
          <div className="flex flex-col items-center gap-1 rounded-md border border-amber-500/60 bg-void/90 p-2 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-amber-400">
                {measurement.distance.toFixed(2)} mm
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPointA(null)
                  setPointB(null)
                }}
                className="rounded px-1 text-xs text-ink-muted hover:bg-raised hover:text-ink"
                title="Clear measurement"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2 font-mono text-xs text-ink-muted">
              <span>ΔX: {measurement.delta.dx.toFixed(1)}</span>
              <span>ΔY: {measurement.delta.dy.toFixed(1)}</span>
              <span>ΔZ: {measurement.delta.dz.toFixed(1)}</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
