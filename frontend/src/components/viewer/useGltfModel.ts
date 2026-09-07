import { useEffect, useState } from 'react'
import type { Group, Material, Object3D, Texture } from 'three'
import { Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type ModelLoadState =
  | { status: 'idle'; object: null; error: null }
  | { status: 'loading'; object: null; error: null }
  | { status: 'ready'; object: Group; error: null }
  | { status: 'error'; object: null; error: Error }

const IDLE: ModelLoadState = { status: 'idle', object: null, error: null }

/**
 * Release every GPU resource an object graph owns.
 *
 * Three.js does not free buffers or textures when an object leaves the scene,
 * so a viewer that swaps models on every parameter change leaks the whole
 * previous mesh unless it disposes explicitly. This walks the graph and
 * releases geometries, materials and any texture a material references.
 */
export function disposeObject(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    node.geometry?.dispose()
    const material = node.material as Material | Material[] | undefined
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (isTexture(value)) value.dispose()
  }
  material.dispose()
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isTexture' in value &&
    (value as { isTexture?: boolean }).isTexture === true
  )
}

/**
 * Load a glTF model, with the disposal that keeps repeated loads bounded.
 *
 * A dedicated loader per URL rather than drei's `useGLTF`, because that hook
 * caches by URL and never evicts: every parameter change produces a new model
 * id, so the cache would grow without limit for the lifetime of the tab.
 */
export function useGltfModel(url: string | null): ModelLoadState {
  const [state, setState] = useState<ModelLoadState>(IDLE)

  useEffect(() => {
    if (!url) {
      setState(IDLE)
      return undefined
    }

    let cancelled = false
    setState({ status: 'loading', object: null, error: null })

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        // A load that finished after the effect was torn down would otherwise
        // sit in GPU memory with nothing referencing it.
        if (cancelled) {
          disposeObject(gltf.scene)
          return
        }
        setState({ status: 'ready', object: gltf.scene, error: null })
      },
      undefined,
      (cause) => {
        if (cancelled) return
        setState({
          status: 'error',
          object: null,
          error: new Error('The generated model could not be loaded.', { cause }),
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [url])

  // Disposal is tied to the object's own lifetime rather than done inline when
  // the next model arrives, so it runs only after React has detached the
  // previous object from the scene graph.
  useEffect(() => {
    const { object } = state
    return () => {
      if (object) disposeObject(object)
    }
  }, [state])

  return state
}
