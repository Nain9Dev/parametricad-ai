import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ApiError,
  generateFromPrompt,
  generateFromSpec,
  isAbortError,
} from '@/lib/apiClient'
import type { ComponentSpec, ExportFormat, GeneratedModel } from '@/types/api'

export type GenerationRequest =
  | { source: 'spec'; spec: ComponentSpec; formats: ExportFormat[] }
  | { source: 'prompt'; prompt: string; formats: ExportFormat[] }

export type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error'

export interface GenerationController {
  status: GenerationStatus
  /** The most recent successful result, kept across a regeneration. */
  model: GeneratedModel | null
  /** Which backend interpreted the prompt, when the result came from one. */
  extractor: string | null
  error: ApiError | null
  generate: (request: GenerationRequest) => void
  cancel: () => void
}

/**
 * Drives generation requests, keeping at most one in flight.
 *
 * Two decisions shape this hook:
 *
 * - A superseded request is aborted, not ignored. The parameter form fires on a
 *   debounce, so without cancellation a slow early request could resolve after
 *   a fast later one and put stale geometry on screen.
 * - Requested formats travel with each request, so a cheap single-format
 *   preview and a full export set are the same code path.
 * - The last successful model survives a regeneration and a failure. Blanking
 *   the viewer on every keystroke would make the preview flicker, and blanking
 *   it on an invalid combination would take away the very model the engineer is
 *   comparing against.
 */
export function useGeneration(): GenerationController {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [model, setModel] = useState<GeneratedModel | null>(null)
  const [extractor, setExtractor] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const inFlight = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    inFlight.current?.abort()
    inFlight.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const generate = useCallback(
    (request: GenerationRequest) => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller

      setStatus('generating')
      setError(null)

      const pending =
        request.source === 'spec'
          ? generateFromSpec(request.spec, request.formats, controller.signal)
          : generateFromPrompt(request.prompt, request.formats, controller.signal)

      pending
        .then((response) => {
          if (controller.signal.aborted) return
          setModel(response.model)
          setExtractor(response.extractor)
          setStatus('ready')
        })
        .catch((cause: unknown) => {
          // An abort means a newer request took over; the state it will settle
          // into is the one that should win.
          if (isAbortError(cause) || controller.signal.aborted) return
          setError(
            cause instanceof ApiError
              ? cause
              : new ApiError('The model could not be generated.', {
                  code: 'unexpected_error',
                  status: 0,
                }),
          )
          setStatus('error')
        })
        .finally(() => {
          if (inFlight.current === controller) inFlight.current = null
        })
    },
    [],
  )

  return { status, model, extractor, error, generate, cancel }
}
