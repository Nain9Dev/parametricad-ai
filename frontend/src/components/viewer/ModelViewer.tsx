import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { GizmoHelper, GizmoViewport, Grid } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Spinner } from '@/components/ui/Spinner'
import { AlertIcon, CubeIcon } from '@/components/ui/Icons'
import { CameraRig } from '@/components/viewer/CameraRig'
import { DimensionOverlay } from '@/components/viewer/DimensionOverlay'
import { ModelObject } from '@/components/viewer/ModelObject'
import { StudioLights } from '@/components/viewer/StudioLights'
import type { ViewerOptions } from '@/components/viewer/viewerOptions'
import { useGltfModel } from '@/components/viewer/useGltfModel'

interface ModelViewerProps {
  url: string | null
  options: ViewerOptions
  /** Bumped by the toolbar to refit the camera without reloading. */
  fitToken: number
  /** True while a newer model is being generated for the current parameters. */
  regenerating: boolean
}

export function ModelViewer({ url, options, fitToken, regenerating }: ModelViewerProps) {
  const model = useGltfModel(url)

  const bounds = useMemo(() => {
    if (model.status !== 'ready') return null
    return new Box3().setFromObject(model.object)
  }, [model])

  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <ViewerMessage
          tone="error"
          title="The 3D view stopped"
          detail={error.message}
          action={{ label: 'Restart the view', onClick: reset }}
        />
      )}
    >
      <div className="relative size-full bg-void">
        <Canvas
          // Rendering on demand rather than at 60 Hz forever: a static part
          // needs no frames at all, and this keeps a laptop fan quiet while an
          // engineer reads the report next to the canvas.
          frameloop="demand"
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            // The canvas is never composited over page content, so an opaque
            // buffer saves the blend and avoids halo artefacts on edges.
            alpha: false,
          }}
          onCreated={({ gl }) => gl.setClearColor('#08090b')}
        >
          <StudioLights />
          <CameraRig
            bounds={bounds}
            projection={options.projection}
            fitToken={fitToken}
          />

          {options.grid && bounds ? <GroundGrid bounds={bounds} /> : null}

          {model.status === 'ready' ? (
            <ModelObject object={model.object} wireframe={options.wireframe} />
          ) : null}

          {options.dimensions && bounds ? <DimensionOverlay bounds={bounds} /> : null}

          {options.axes ? (
            <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
              <GizmoViewport
                axisColors={['#f87171', '#34d399', '#3d8bfd']}
                labelColor="#0b0d10"
              />
            </GizmoHelper>
          ) : null}
        </Canvas>

        <ViewerOverlays model={model} url={url} regenerating={regenerating} />
      </div>
    </ErrorBoundary>
  )
}

/**
 * A ground grid scaled to the part.
 *
 * A fixed grid is useless across this range: 1 mm cells vanish under a 3 m beam
 * and a 100 mm grid gives no reference at all for a washer. The cell size steps
 * by powers of ten so it always reads as a sensible unit.
 */
function GroundGrid({ bounds }: { bounds: Box3 }) {
  const { cellSize, sectionSize, extent, floor } = useMemo(() => {
    const size = bounds.getSize(new Vector3())
    const span = Math.max(size.x, size.z, 1)
    const cell = 10 ** Math.round(Math.log10(span / 10))
    return {
      cellSize: cell,
      sectionSize: cell * 10,
      extent: Math.max(span * 4, cell * 20),
      floor: bounds.min.y,
    }
  }, [bounds])

  return (
    <Grid
      position={[0, floor, 0]}
      args={[extent, extent]}
      cellSize={cellSize}
      cellThickness={0.6}
      cellColor="#232935"
      sectionSize={sectionSize}
      sectionThickness={1}
      sectionColor="#333c4d"
      fadeDistance={extent}
      fadeStrength={1.4}
      followCamera={false}
      infiniteGrid
    />
  )
}

interface OverlayProps {
  model: ReturnType<typeof useGltfModel>
  url: string | null
  regenerating: boolean
}

function ViewerOverlays({ model, url, regenerating }: OverlayProps) {
  // The overlay is a live region: the canvas itself tells a screen reader
  // nothing, so state changes have to be announced in text.
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (regenerating) setAnnouncement('Generating the model.')
    else if (model.status === 'loading') setAnnouncement('Loading the generated model.')
    else if (model.status === 'ready') setAnnouncement('Model ready.')
    else if (model.status === 'error') setAnnouncement('The model could not be displayed.')
    else setAnnouncement('No model yet.')
  }, [model.status, regenerating])

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {!url && !regenerating ? (
        <ViewerMessage
          tone="idle"
          title="No model yet"
          detail="Set the parameters or describe the part, then generate to see it here."
        />
      ) : null}

      {model.status === 'error' ? (
        <ViewerMessage
          tone="error"
          title="The model could not be displayed"
          detail={model.error.message}
        />
      ) : null}

      {model.status === 'loading' || regenerating ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs text-ink-muted backdrop-blur">
            <Spinner className="size-3.5" />
            {regenerating ? 'Generating geometry' : 'Loading mesh'}
          </span>
        </div>
      ) : null}
    </>
  )
}

interface ViewerMessageProps {
  tone: 'idle' | 'error'
  title: string
  detail: string
  action?: { label: string; onClick: () => void }
}

function ViewerMessage({ tone, title, detail, action }: ViewerMessageProps) {
  const isError = tone === 'error'
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-void/80 p-6 text-center backdrop-blur-sm">
      <div className="max-w-xs space-y-2">
        <div
          className={`mx-auto flex size-10 items-center justify-center rounded-full border ${
            isError
              ? 'border-invalid/35 bg-invalid/10 text-invalid'
              : 'border-line bg-raised text-ink-faint'
          }`}
        >
          {isError ? <AlertIcon /> : <CubeIcon />}
        </div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-faint">{detail}</p>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1 rounded-md border border-line bg-raised px-3 py-1.5 text-xs text-ink transition-colors hover:border-line-strong"
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  )
}
