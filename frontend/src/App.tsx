import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AppHeader } from '@/components/layout/AppHeader'
import { ComponentPicker } from '@/components/generator/ComponentPicker'
import { ParameterForm } from '@/components/generator/ParameterForm'
import { PromptComposer } from '@/components/generator/PromptComposer'
import { ShowcaseBar } from '@/components/generator/ShowcaseBar'
import { SHOWCASE_PRESETS, type ShowcasePreset } from '@/lib/presets'
import { ArtifactList } from '@/components/report/ArtifactList'
import { GenerationError } from '@/components/report/GenerationError'
import { PropertiesPanel } from '@/components/report/PropertiesPanel'
import { QualityReport } from '@/components/report/QualityReport'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { DownloadIcon, SparkIcon } from '@/components/ui/Icons'
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar'
import type { ViewOrientation } from '@/components/viewer/viewDirections'
import {
  DEFAULT_VIEWER_OPTIONS,
  type ViewerOptions,
} from '@/components/viewer/viewerOptions'
import { absoluteUrl } from '@/lib/apiClient'
import {
  buildSpec,
  defaultValues,
  findComponent,
  valuesFromSpec,
  type ParameterValues,
} from '@/lib/catalog'
import { useCatalog } from '@/lib/hooks/useCatalog'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useGeneration } from '@/lib/hooks/useGeneration'
import type {
  Catalog,
  ComponentKind,
  ComponentSpec,
  ExportFormat,
  GeneratedModel,
  ParameterValue,
} from '@/types/api'

type InputMode = 'parameters' | 'prompt'

/**
 * A preview only needs the mesh the viewer will display; the exact B-Rep
 * formats are produced on request, so dragging a slider does not pay for a
 * STEP export nobody asked for.
 */
/** Three.js is the bulk of the bundle; the form and report render before it arrives. */
const ModelViewer = lazy(() =>
  import('@/components/viewer/ModelViewer').then((module) => ({ default: module.ModelViewer })),
)

const PREVIEW_FORMATS: ExportFormat[] = ['glb']

/** Long enough to absorb a burst of typing, short enough to feel live. */
const PREVIEW_DEBOUNCE_MS = 350

export default function App() {
  const catalog = useCatalog()
  const generation = useGeneration()

  // Instant local catalog fallback: loads in < 10ms from bundled preset
  const [localCatalog, setLocalCatalog] = useState<Catalog | null>(null)

  useEffect(() => {
    fetch('/presets/catalog.json')
      .then((res) => {
        if (!res.ok) throw new Error('Preset catalog fetch failed')
        return res.json()
      })
      .then((cat: Catalog) => setLocalCatalog(cat))
      .catch(() => {})
  }, [])

  const activeCatalog = catalog.catalog ?? localCatalog
  const isCatalogReady = activeCatalog !== null

  const [mode, setMode] = useState<InputMode>('parameters')
  const [kind, setKind] = useState<ComponentKind>('flange')
  const [activePresetId, setActivePresetId] = useState<string | null>('flange')
  const [valuesByKind, setValuesByKind] = useState<
    Partial<Record<ComponentKind, ParameterValues>>
  >({})
  const [livePreview, setLivePreview] = useState(true)
  const [viewerOptions, setViewerOptions] = useState<ViewerOptions>(DEFAULT_VIEWER_OPTIONS)
  const [fitToken, setFitToken] = useState(0)
  const [viewOrientation, setViewOrientation] = useState<ViewOrientation>('iso')

  // Track last spec to avoid duplicate debounce calls after preset click
  const lastRequestedSpecKey = useRef<string | null>(null)
  const initialGenerated = useRef(false)

  // A prompt result should populate the form; a parametric result must not,
  // because writing back the spec we just sent would retrigger the debounce and
  // loop. This flag lets exactly one incoming model through.
  const awaitingPromptSync = useRef(false)

  // Held stable across renders: an effect below depends on it, and a fresh
  // array each render would make that effect run on every commit.
  const components = useMemo(() => activeCatalog?.components ?? [], [activeCatalog])
  const component = findComponent(components, kind)
  const values = valuesByKind[kind]

  // Seed a component's values from the schema defaults the first time it is
  // selected, so switching back preserves whatever was dialled in before.
  useEffect(() => {
    if (!component) return
    setValuesByKind((previous) =>
      previous[kind] ? previous : { ...previous, [kind]: defaultValues(component) },
    )
  }, [component, kind])

  const { generate, seedModel } = generation

  // Fast-path instant load: seed bundled flange preset in <15ms before network settles
  useEffect(() => {
    fetch('/presets/flange.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { model?: GeneratedModel } | null) => {
        if (data?.model && !generation.model) {
          seedModel(data.model)
        }
      })
      .catch(() => {})
  }, [seedModel, generation.model])

  // Instant initial load: as soon as catalog is ready, generate the industrial flange preset!
  useEffect(() => {
    if (initialGenerated.current || !activeCatalog) return
    const defaultPreset = SHOWCASE_PRESETS[0]
    if (!defaultPreset) return
    initialGenerated.current = true
    const target = findComponent(activeCatalog.components, 'flange')
    if (target) {
      setValuesByKind((prev) => ({
        ...prev,
        flange: valuesFromSpec(defaultPreset.spec, target),
      }))
    }
    lastRequestedSpecKey.current = JSON.stringify(defaultPreset.spec)
    generate({
      source: 'spec',
      spec: defaultPreset.spec,
      formats: PREVIEW_FORMATS,
    })
  }, [activeCatalog, generate])

  const spec = useMemo(
    () => (values ? buildSpec(kind, values) : null),
    [kind, values],
  )

  // Debouncing the serialised spec rather than the object compares by value: a
  // re-render that produces an equal spec must not count as a change.
  const specKey = spec ? JSON.stringify(spec) : null
  const debouncedSpecKey = useDebouncedValue(specKey, PREVIEW_DEBOUNCE_MS)

  useEffect(() => {
    if (mode !== 'parameters' || !livePreview || !debouncedSpecKey) return
    if (lastRequestedSpecKey.current === debouncedSpecKey) return
    lastRequestedSpecKey.current = debouncedSpecKey
    generate({
      source: 'spec',
      spec: JSON.parse(debouncedSpecKey),
      formats: PREVIEW_FORMATS,
    })
  }, [debouncedSpecKey, mode, livePreview, generate])

  useEffect(() => {
    if (!awaitingPromptSync.current || !generation.model) return
    const extracted = generation.model.spec
    const target = findComponent(components, extracted.kind)
    if (!target) return

    awaitingPromptSync.current = false
    setKind(extracted.kind)
    setValuesByKind((previous) => ({
      ...previous,
      [extracted.kind]: valuesFromSpec(extracted, target),
    }))
  }, [generation.model, components])

  const updateParameter = useCallback(
    (name: string, value: ParameterValue) => {
      setActivePresetId(null)
      setValuesByKind((previous) => ({
        ...previous,
        [kind]: { ...previous[kind], [name]: value },
      }))
    },
    [kind],
  )

  const submitPrompt = useCallback(
    (prompt: string) => {
      awaitingPromptSync.current = true
      generate({ source: 'prompt', prompt, formats: PREVIEW_FORMATS })
    },
    [generate],
  )

  const handleSelectPreset = useCallback(
    (preset: ShowcasePreset) => {
      setActivePresetId(preset.id)
      if (preset.id === 'prompt') {
        setMode('prompt')
        setKind('pipe')
        if (preset.promptText) {
          submitPrompt(preset.promptText)
        }
      } else {
        setMode('parameters')
        setKind(preset.kind)
        const target = findComponent(components, preset.kind)
        if (target) {
          setValuesByKind((prev) => ({
            ...prev,
            [preset.kind]: valuesFromSpec(preset.spec, target),
          }))
        }
        lastRequestedSpecKey.current = JSON.stringify(preset.spec)

        // Fast-path: seed local preset bundle instantaneously in <10ms
        fetch(`/presets/${preset.id}.json`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { model?: GeneratedModel } | null) => {
            if (data?.model) {
              seedModel(data.model)
            }
          })
          .catch(() => {})

        generate({
          source: 'spec',
          spec: preset.spec,
          formats: PREVIEW_FORMATS,
        })
      }
      setFitToken((token) => token + 1)
    },
    [components, submitPrompt, generate, seedModel],
  )

  const handleExportProject = useCallback(() => {
    if (!generation.model) return
    const project = {
      app: 'ParametriCAD AI',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      model: generation.model,
    }
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cadproject_${generation.model.spec.kind}_${generation.model.model_id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [generation.model])

  const handleImportProject = useCallback(
    (importedSpec: ComponentSpec) => {
      const target = findComponent(components, importedSpec.kind)
      if (!target) return
      setMode('parameters')
      setKind(importedSpec.kind)
      setActivePresetId(null)
      setValuesByKind((prev) => ({
        ...prev,
        [importedSpec.kind]: valuesFromSpec(importedSpec, target),
      }))
      generate({
        source: 'spec',
        spec: importedSpec,
        formats: PREVIEW_FORMATS,
      })
      setFitToken((t) => t + 1)
    },
    [components, generate],
  )

  const refinePrompt = useCallback(
    (prompt: string) => {
      if (!generation.model?.spec) return
      awaitingPromptSync.current = true
      generate({
        source: 'refine',
        current_spec: generation.model.spec,
        prompt,
        formats: PREVIEW_FORMATS,
      })
    },
    [generate, generation.model],
  )

  const generateNow = useCallback(() => {
    if (!spec) return
    generate({ source: 'spec', spec, formats: PREVIEW_FORMATS })
  }, [generate, spec])

  const exportEverything = useCallback(() => {
    if (!spec || !activeCatalog) return
    generate({
      source: 'spec',
      spec,
      formats: activeCatalog.formats.map((descriptor) => descriptor.format),
    })
  }, [generate, spec, activeCatalog])

  const busy = generation.status === 'generating'
  const model = generation.model
  const previewUrl = model?.artifacts.glb ? absoluteUrl(model.artifacts.glb.url) : null
  const hasEveryFormat =
    model !== null &&
    activeCatalog !== null &&
    activeCatalog.formats.every((descriptor) => model.artifacts[descriptor.format])

  return (
    // Two layouts, not one that degrades: a pinned three-column workspace
    // where there is room for it, and a scrolling stack where there is not.
    <div className="flex min-h-screen flex-col bg-void lg:h-screen lg:overflow-hidden">
      <AppHeader
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        hasModel={!!generation.model}
      />

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[17rem_minmax(0,1fr)_17rem] xl:grid-cols-[20rem_minmax(0,1fr)_21rem]">
        {/* ---------------------------------------------------------- Inputs */}
        <aside className="space-y-3 border-line p-3 lg:min-h-0 lg:overflow-y-auto lg:border-r">
          <ShowcaseBar
            activePresetId={activePresetId}
            onSelectPreset={handleSelectPreset}
            busy={busy}
          />

          <SegmentedControl
            label="Input mode"
            value={mode}
            onChange={setMode}
            segments={[
              { value: 'parameters', label: 'Parameters' },
              { value: 'prompt', label: 'Description' },
            ]}
          />

          {!isCatalogReady && catalog.status === 'loading' ? (
            <InputSkeleton waking={catalog.slow} />
          ) : null}

          {!isCatalogReady && catalog.status === 'error' ? (
            <GenerationError error={catalog.error} onRetry={catalog.retry} />
          ) : null}

          {isCatalogReady && component ? (
            mode === 'parameters' ? (
              <>
                <Panel title="Component">
                  <ComponentPicker
                    components={components}
                    value={kind}
                    onChange={(newKind) => {
                      setKind(newKind)
                      setActivePresetId(newKind)
                    }}
                    disabled={busy && !livePreview}
                  />
                  <p className="mt-2 text-[0.6875rem] leading-snug text-ink-faint">
                    {component.description}
                  </p>
                </Panel>

                <Panel
                  title="Parameters"
                  description={`${component.parameters.length} fields from the live schema`}
                >
                  {values ? (
                    <ParameterForm
                      component={component}
                      values={values}
                      onChange={updateParameter}
                    />
                  ) : null}
                </Panel>

                <Panel bodyClassName="p-3 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={livePreview}
                      onChange={(event) => setLivePreview(event.target.checked)}
                      className="size-3.5 accent-[#3d8bfd]"
                    />
                    Regenerate as I edit
                  </label>
                  {!livePreview ? (
                    <Button
                      variant="primary"
                      className="w-full"
                      busy={busy}
                      onClick={generateNow}
                      icon={<SparkIcon />}
                    >
                      Generate
                    </Button>
                  ) : null}
                </Panel>
              </>
            ) : (
              <Panel title="Natural language">
                <PromptComposer
                  onSubmit={submitPrompt}
                  onRefine={refinePrompt}
                  currentSpec={generation.model?.spec ?? null}
                  busy={busy}
                  extractor={generation.extractor}
                />
              </Panel>
            )
          ) : null}
        </aside>

        {/* ---------------------------------------------------------- Viewer */}
        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 py-2">
            <ViewerToolbar
              options={viewerOptions}
              onChange={setViewerOptions}
              onResetView={() => setFitToken((token) => token + 1)}
              activeOrientation={viewOrientation}
              onSelectOrientation={(orientation) => {
                setViewOrientation(orientation)
                setFitToken((token) => token + 1)
              }}
              disabled={!previewUrl}
            />
            {model ? (
              <code className="hidden shrink-0 text-[0.625rem] text-ink-faint xl:block">
                {model.model_id.slice(0, 12)}
              </code>
            ) : null}
          </div>

          {/* A definite height while stacked; the remaining space once pinned.
              Without the first, the canvas has nothing to measure and collapses
              to its intrinsic 300x150. */}
          <div className="h-[55vh] min-h-[22rem] lg:h-auto lg:min-h-0 lg:flex-1">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <ModelViewer
                url={previewUrl}
                options={viewerOptions}
                fitToken={fitToken}
                viewOrientation={viewOrientation}
                regenerating={busy}
              />
            </Suspense>
          </div>
        </main>

        {/* ---------------------------------------------------------- Report */}
        <aside className="space-y-3 border-line p-3 lg:min-h-0 lg:overflow-y-auto lg:border-l">
          {generation.error ? (
            <GenerationError
              error={generation.error}
              onRetry={mode === 'parameters' ? generateNow : undefined}
            />
          ) : null}

          {!model && busy ? <ReportSkeleton /> : null}

          {!model && !busy && !generation.error ? (
            <Panel title="Report">
              <p className="text-xs leading-relaxed text-ink-faint">
                Generate a part to see its mass properties, the mesh validation
                verdict and the downloadable artifacts.
              </p>
            </Panel>
          ) : null}

          {model ? (
            <>
              <Panel title="Mesh validation" description="Checked on the generated mesh">
                <QualityReport report={model.quality} />
              </Panel>

              <Panel title="Properties" description="Measured on the exact solid">
                <PropertiesPanel model={model} />
              </Panel>

              <Panel
                title="Artifacts"
                actions={
                  !hasEveryFormat && activeCatalog ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      busy={busy}
                      onClick={exportEverything}
                      icon={<DownloadIcon className="size-3.5" />}
                    >
                      All formats
                    </Button>
                  ) : null
                }
              >
                <ArtifactList model={model} formats={activeCatalog?.formats ?? []} />
              </Panel>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function InputSkeleton({ waking }: { waking: boolean }) {
  return (
    <div className="space-y-3">
      {/* The hosted backend suspends when idle. Saying so beats a skeleton that
          sits still for a minute and reads as a broken deploy. */}
      {waking ? (
        <p
          role="status"
          className="rounded-panel border border-line bg-surface px-3 py-2.5 text-[0.6875rem] leading-relaxed text-ink-muted"
        >
          Waking the generation service. It sleeps while unused, so the first
          request can take up to a minute.
        </p>
      ) : null}
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function ReportSkeleton() {
  return (
    <Panel title="Generating">
      <div className="space-y-3">
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div className="animate-indeterminate h-full w-1/3 rounded-full bg-accent" />
        </div>
        <SkeletonText lines={4} />
      </div>
    </Panel>
  )
}
