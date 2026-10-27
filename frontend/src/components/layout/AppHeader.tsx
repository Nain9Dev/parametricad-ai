import { useEffect, useState } from 'react'

import { HeaderMenu } from '@/components/layout/HeaderMenu'
import { InstallButton } from '@/components/layout/InstallButton'
import { OfflineBadge } from '@/components/layout/OfflineBadge'
import { Badge } from '@/components/ui/Badge'
import { CubeIcon, DownloadIcon } from '@/components/ui/Icons'
import { fetchHealth, isAbortError } from '@/lib/apiClient'
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt'
import { useLocale } from '@/lib/hooks/useLocale'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'
import { readProjectFile } from '@/lib/projectFile'
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
 * export/import capabilities for instant CAD session mobility. Below 640 px there
 * is no room for two labelled buttons, a tagline and a status label, so the
 * project actions move into a menu and the status shrinks to its dot.
 */
export function AppHeader({ onExportProject, onImportProject, hasModel }: AppHeaderProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [reachable, setReachable] = useState<boolean | null>(null)
  const online = useOnlineStatus()
  const install = useInstallPrompt()
  const { locale, setLocale, t } = useLocale()

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

  const statusLabel = reachable ? `Cloud v${health?.version}` : '24/7 Demo Activa'

  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-1 sm:gap-4 sm:py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent/12 text-accent">
          <CubeIcon className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <h1 className="text-sm font-semibold tracking-tight text-ink">ParametriCAD</h1>
          <p className="hidden text-xs text-ink-faint sm:block">
            {t('header.subtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label={locale === 'en' ? 'Language selector' : 'Selector de idioma'}
          className="inline-flex items-center rounded-md border border-line bg-surface-alt/70 p-0.5 text-xs font-semibold"
        >
          <button
            type="button"
            onClick={() => setLocale('es')}
            className={`rounded px-1.5 py-0.5 text-xs font-mono transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
              locale === 'es'
                ? 'bg-accent/15 text-accent font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
            aria-pressed={locale === 'es'}
            title="Español (por defecto)"
          >
            ES
          </button>
          <span className="text-ink-faint" aria-hidden="true">/</span>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`rounded px-1.5 py-0.5 text-xs font-mono transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
              locale === 'en'
                ? 'bg-accent/15 text-accent font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
            aria-pressed={locale === 'en'}
            title="English"
          >
            EN
          </button>
        </div>

        <InstallButton
          canInstall={install.canInstall}
          showIosHint={install.showIosHint}
          onInstall={() => {
            void install.promptInstall()
          }}
        />
        {onExportProject && hasModel && (
          <button
            type="button"
            onClick={onExportProject}
            className="hidden sm:inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink pointer-coarse:h-11"
            title="Save active CAD project to JSON"
          >
            <DownloadIcon className="size-3" />
            Save Project
          </button>
        )}
        {onImportProject && (
          <label
            className="hidden sm:inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink pointer-coarse:h-11"
            title="Open CAD project from JSON"
          >
            <CubeIcon className="size-3" />
            Open Project
            <input
              type="file"
              accept=".json"
              className="sr-only"
              onChange={(event) => {
                const input = event.target
                const file = input.files?.[0]
                if (!file) return
                void readProjectFile(file).then((spec) => {
                  if (spec) onImportProject(spec)
                })
                input.value = ''
              }}
            />
          </label>
        )}
        {onExportProject || onImportProject ? (
          <HeaderMenu
            className="sm:hidden"
            hasModel={!!hasModel}
            onExportProject={onExportProject}
            onImportProject={onImportProject}
          />
        ) : null}

        {health ? (
          <span className="hidden text-xs text-ink-faint lg:inline">
            {EXTRACTOR_LABELS[health.parameter_extractor] ?? health.parameter_extractor}
            {' · '}
            {health.geometry_kernel}
          </span>
        ) : null}
        {online ? (
          <Badge tone="valid">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                reachable ? 'bg-valid animate-pulse' : 'bg-valid'
              }`}
            />
            <span className="sr-only sm:not-sr-only">{statusLabel}</span>
          </Badge>
        ) : (
          <OfflineBadge />
        )}
      </div>
    </header>
  )
}
