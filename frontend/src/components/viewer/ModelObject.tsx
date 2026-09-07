import { useEffect, useMemo } from 'react'
import { DoubleSide, FrontSide, Mesh, MeshStandardMaterial } from 'three'
import type { Group } from 'three'

interface ModelObjectProps {
  object: Group
  wireframe: boolean
}

/**
 * Renders a loaded model under a single shared material.
 *
 * The exported glTF carries whatever default material the mesh exporter wrote,
 * which differs from the surface an engineer expects and would make the
 * wireframe toggle depend on the exporter. Substituting one material gives a
 * consistent read across every part, makes the toggle a single flag, and drops
 * the per-node materials that arrived with the file.
 */
export function ModelObject({ object, wireframe }: ModelObjectProps) {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#b8c2d0',
        metalness: 0.55,
        roughness: 0.38,
        // Back faces stay hidden in solid shading -- seeing through a wall
        // would misrepresent the part -- but a wireframe has to show both.
        side: FrontSide,
      }),
    [],
  )

  useEffect(() => {
    const replaced: unknown[] = []
    object.traverse((node) => {
      if (!(node instanceof Mesh)) return
      if (node.material && node.material !== material) replaced.push(node.material)
      node.material = material
      node.castShadow = false
      node.receiveShadow = false
    })

    // The materials that came with the file are now unreferenced.
    for (const node of replaced) {
      const stale = node as { dispose?: () => void }
      stale.dispose?.()
    }
  }, [object, material])

  useEffect(() => {
    material.wireframe = wireframe
    material.side = wireframe ? DoubleSide : FrontSide
    material.needsUpdate = true
  }, [material, wireframe])

  // The loaded graph belongs to the loading hook, which disposes it; the
  // material created here is the only resource this component owns.
  useEffect(() => () => material.dispose(), [material])

  return <primitive object={object} />
}
