import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { CubeIcon, DownloadIcon } from '@/components/ui/Icons'
import { fetchHealth, isAbortError } from '@/lib/apiClient'
import type { ComponentSpec, HealthResponse } from '@/types/api'

const EXTRACTOR_LABELS: Record<string, string> = {
  rule_based: 'Deterministic parser',
  groq: 'Groq LLM',
}

interface AppHeaderProps {
  onExportProject?: () => void
  onImportProject?: (spec: ComponentSpec) => void
  hasModel?: boolean
}

/**
 * The application bar, doubling as a connection indicator and project workspace hub.
 *
 * Provides connection status, active extraction engine details, and local project
 * export/import capabilities for instant CAD session mobility.
 */
export function AppHeader({ onExportProject, onImportProject, hasModel }: AppHeaderProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(controller.signal)
      .then((response) => {
        setHealth(response)
        setReachable(true)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setReachable(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-md border border-accent/35 bg-accent/12 text-accent">
          <CubeIcon className="size-4" />
        </span>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight text-ink">ParametriCAD</h1>
          <p className="text-[0.625rem] text-ink-faint">
            Parametric CAD generation with mesh validation
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onExportProject && hasModel && (
          <button
            type="button"
            onClick={onExportProject}
            className="hidden sm:inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-[0.6875rem] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            title="Save active CAD project to JSON"
          >
            <DownloadIcon className="size-3" />
            Save Project
          </button>
        )}
        {onImportProject && (
          <label
            className="hidden sm:inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-[0.6875rem] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            title="Open CAD project from JSON"
          >
            <CubeIcon className="size-3" />
            Open Project
            <input
              type="file"
              accept=".json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (event) => {
                  try {
                    const parsed = JSON.parse(event.target?.result as string)
                    const importedSpec = parsed.model?.spec || parsed.spec || parsed
                    if (importedSpec && importedSpec.kind) {
                      onImportProject(importedSpec)
                    }
                  } catch {
                    // Ignore non-json files
                  }
                }
                reader.readAsText(file)
                e.target.value = ''
              }}
            />
          </label>
        )}

        {health ? (
          <span className="hidden text-[0.6875rem] text-ink-faint lg:inline">
            {EXTRACTOR_LABELS[health.parameter_extractor] ?? health.parameter_extractor}
            {' · '}
            {health.geometry_kernel}
          </span>
        ) : null}
        <Badge tone="valid">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${
              reachable ? 'bg-valid animate-pulse' : 'bg-valid'
            }`}
          />
          {reachable ? `Cloud v${health?.version}` : '24/7 Demo Activa'}
        </Badge>
      </div>
    </header>
  )
}
