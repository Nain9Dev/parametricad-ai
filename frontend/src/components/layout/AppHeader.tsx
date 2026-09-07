import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { CubeIcon } from '@/components/ui/Icons'
import { fetchHealth, isAbortError } from '@/lib/apiClient'
import type { HealthResponse } from '@/types/api'

const EXTRACTOR_LABELS: Record<string, string> = {
  rule_based: 'Deterministic parser',
  groq: 'Groq LLM',
}

/**
 * The application bar, doubling as a connection indicator.
 *
 * Which extraction backend is live changes what a prompt will do, so it is
 * stated up front rather than being something to infer from the results.
 */
export function AppHeader() {
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
        {health ? (
          <span className="hidden text-[0.6875rem] text-ink-faint sm:inline">
            {EXTRACTOR_LABELS[health.parameter_extractor] ?? health.parameter_extractor}
            {' · '}
            {health.geometry_kernel}
          </span>
        ) : null}
        <Badge tone={reachable === false ? 'invalid' : reachable ? 'valid' : 'neutral'}>
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${
              reachable === false
                ? 'bg-invalid'
                : reachable
                  ? 'bg-valid'
                  : 'bg-ink-faint'
            }`}
          />
          {reachable === false ? 'Offline' : reachable ? `v${health?.version}` : 'Connecting'}
        </Badge>
      </div>
    </header>
  )
}
