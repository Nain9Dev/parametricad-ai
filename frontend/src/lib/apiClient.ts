/**
 * Typed API client.
 *
 * Built on `fetch` with an `AbortSignal` on every call: the parameter form
 * regenerates on a debounce, so a request that has been superseded must be
 * cancelled rather than left to land out of order over a newer result.
 *
 * The backend answers every failure with the same envelope, so failures are
 * surfaced as one `ApiError` carrying the machine-readable code and the hint
 * instead of a bare status number.
 */

import {
  bundledKindForPrompt,
  bundledKindForSpec,
  type BundledKind,
} from '@/lib/bundledPresets'
import type {
  ApiErrorResponse,
  Catalog,
  ComponentKind,
  ComponentSpec,
  ExportFormat,
  GenerationResponse,
  HealthResponse,
} from '@/types/api'

/** The backend's reserved local port; see `docs/10-runbook.md`. */
const DEFAULT_BASE_URL = 'http://localhost:8130'

/** Trailing slashes would double up when joined with a path. */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ?? DEFAULT_BASE_URL
).replace(/\/+$/, '')

/** A failure the backend described, or a transport failure described locally. */
export class ApiError extends Error {
  readonly code: string
  readonly hint: string | null
  readonly details: Record<string, unknown>
  readonly status: number

  constructor(
    message: string,
    options: {
      code: string
      status: number
      hint?: string | null
      details?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status
    this.hint = options.hint ?? null
    this.details = options.details ?? {}
  }

  /** True when retrying the identical request is worth doing. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 503 || this.status >= 500
  }
}

/** Resolve an API-relative path, such as an artifact URL, against the origin. */
export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('./presets/')) return path.replace(/^\./, '')
  if (path.startsWith('/presets/')) return path
  if (path.startsWith('presets/')) return `/${path}`
  return `${API_BASE_URL}${path}`
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function readError(response: Response): Promise<ApiError> {
  let body: ApiErrorResponse | null = null
  try {
    body = (await response.json()) as ApiErrorResponse
  } catch {
    body = null
  }

  if (body?.error) {
    return new ApiError(body.error.message, {
      code: body.error.code,
      status: response.status,
      hint: body.error.hint,
      details: body.error.details,
    })
  }

  return new ApiError(`The server responded with ${response.status}.`, {
    code: 'unexpected_response',
    status: response.status,
  })
}

/**
 * The service could not be reached.
 *
 * When the device itself reports no connection, say that instead: it is the more
 * useful thing to know, and it tells the user the bundled presets are still there.
 */
function unreachableError(): ApiError {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new ApiError('You are offline.', {
      code: 'offline',
      status: 0,
      hint: 'Generating custom parts needs a connection. The bundled presets still work.',
    })
  }
  return new ApiError('Could not reach the generation service.', {
    code: 'network_unreachable',
    status: 0,
    hint: 'Check that the backend is running and reachable from this origin.',
  })
}

async function request<T>(
  path: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    })
  } catch (error) {
    // An abort is the caller's own doing, so it propagates untouched and the
    // caller can tell it apart from a real network failure.
    if (isAbort(error)) throw error
    throw unreachableError()
  }

  if (!response.ok) throw await readError(response)
  return (await response.json()) as T
}

async function postJson<T>(
  path: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  })
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/health', signal ? { signal } : {})
}

export async function loadPresetModel(
  kind: ComponentKind,
  signal?: AbortSignal,
): Promise<GenerationResponse> {
  const res = await fetch(`/presets/${kind}.json`, signal ? { signal } : {})
  if (!res.ok) {
    throw new ApiError(`Preset ${kind} could not be loaded.`, {
      code: 'preset_unavailable',
      status: res.status,
    })
  }
  const data = (await res.json()) as GenerationResponse
  if (data?.model?.artifacts?.glb) {
    data.model.artifacts.glb.url = `/presets/${kind}.glb`
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nain:telemetry', {
        detail: {
          type: 'Command',
          name: `GenerateCADModel (${kind})`,
          latencyMs: 12,
          status: 200,
          payload: {
            kind,
            preset: true,
            watertight: data.model.quality.is_watertight,
            euler: data.model.quality.euler_characteristic,
            triangles: data.model.quality.triangle_count,
            mass_g: Math.round(data.model.properties.mass_g * 100) / 100,
            format: 'glb',
          },
        },
      }),
    )
  }

  return data
}

export function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  return request<Catalog>('/api/v1/catalog', signal ? { signal } : {})
}

/** A cancellable sleep that rejects like an aborted request, so one catch covers both. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/** Coerce an unknown rejection into the failure type the client surfaces. */
export function asApiError(cause: unknown): ApiError {
  return cause instanceof ApiError
    ? cause
    : new ApiError('The catalog could not be loaded.', {
        code: 'catalog_unavailable',
        status: 0,
      })
}

/**
 * Load the catalog, retrying transient failures with a growing backoff.
 *
 * A transport failure or a server overload is worth retrying because a service
 * resuming from idle refuses connections for a few seconds; a failure the
 * backend actually described is surfaced at once, since retrying it would only
 * produce the same answer.
 */
export async function fetchCatalogWithRetry(
  signal: AbortSignal,
  backoffMs: readonly number[] = [1_000, 3_000, 6_000],
): Promise<Catalog> {
  for (let tries = 0; ; tries += 1) {
    try {
      return await fetchCatalog(signal)
    } catch (cause) {
      if (isAbort(cause) || signal.aborted) throw cause
      const error = asApiError(cause)
      const backoff = backoffMs[tries]
      if (!error.isRetryable || backoff === undefined) throw error
      await delay(backoff, signal)
    }
  }
}

/**
 * How long the client waits for the generation service (ADR-0008).
 *
 * A request that a bundled model can answer races the service for four seconds,
 * so the one-click demos stay instant while it sleeps. Any other request has no
 * stand-in, and giving up early would only report a slow but healthy service as
 * unreachable, so it gets twenty seconds.
 */
export const PRESET_RACE_TIMEOUT_MS = 4_000
export const GENERATION_TIMEOUT_MS = 20_000

function timeoutError(): ApiError {
  return new ApiError('The generation service took too long to answer.', {
    code: 'generation_timeout',
    status: 0,
    hint: 'It may be waking up. Try again in a moment.',
  })
}

/**
 * Run one call to the generation service under a client budget.
 *
 * The caller's own abort propagates untouched, so a superseded request stays
 * distinguishable. An expired budget becomes a retryable `ApiError` rather than
 * a bare `AbortError`, which `useGeneration` ignores and would leave the spinner
 * running for good.
 */
async function callService<T>(
  call: (signal: AbortSignal) => Promise<T>,
  budgetMs: number,
  caller: AbortSignal | undefined,
): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (caller?.aborted) abort()
  caller?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, budgetMs)

  try {
    return await call(controller.signal)
  } catch (error) {
    if (caller?.aborted) throw error
    if (isAbort(error)) throw timeoutError()
    throw error
  } finally {
    clearTimeout(timer)
    caller?.removeEventListener('abort', abort)
  }
}

/**
 * Whether a failure leaves a bundled model free to answer.
 *
 * Only a service that could not be reached, did not answer, or broke on its own
 * (a 5xx). A failure the service described, such as `invalid_parameters`, is its
 * answer and has to reach the user as it is.
 */
function allowsBundledAnswer(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

/** The bundled model, or the reason the service could not answer if it is missing too. */
async function bundledAnswer(
  kind: BundledKind,
  signal: AbortSignal | undefined,
  why: ApiError,
): Promise<GenerationResponse> {
  try {
    return await loadPresetModel(kind, signal)
  } catch {
    throw why
  }
}

function announceGeneration(kind: ComponentKind, res: GenerationResponse): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('nain:telemetry', {
      detail: {
        type: 'Command',
        name: `GenerateCADModel (${kind})`,
        latencyMs: Math.round(res.model.timings.total_ms),
        status: 200,
        payload: {
          kind,
          preset: false,
          watertight: res.model.quality.is_watertight,
          euler: res.model.quality.euler_characteristic,
          triangles: res.model.quality.triangle_count,
          mass_g: Math.round(res.model.properties.mass_g * 100) / 100,
        },
      },
    }),
  )
}

/**
 * Generate a part from a specification.
 *
 * If the service is unreachable, silent or failing on its own, a bundled model
 * answers only when the specification is exactly the one it was built from;
 * otherwise the failure is reported, so the viewer never shows a part the form
 * did not ask for (ADR-0008, REQ-UNW-04). A failure the service described is
 * always reported as it is (REQ-UNW-05).
 */
export async function generateFromSpec(
  spec: ComponentSpec,
  formats: ExportFormat[],
  signal?: AbortSignal,
): Promise<GenerationResponse> {
  const bundled = bundledKindForSpec(spec)

  try {
    const res = await callService(
      (remote) => postJson<GenerationResponse>('/api/v1/models', { spec, formats }, remote),
      bundled ? PRESET_RACE_TIMEOUT_MS : GENERATION_TIMEOUT_MS,
      signal,
    )
    announceGeneration(spec.kind, res)
    return res
  } catch (error) {
    if (signal?.aborted) throw error
    if (bundled && allowsBundledAnswer(error)) return bundledAnswer(bundled, signal, error)
    throw error
  }
}

/**
 * Generate a part from a description.
 *
 * The same rule as `generateFromSpec`, with the showcase prompt as the one
 * description a bundled model can answer. No kind is ever guessed from keywords:
 * that invented a specification the user never gave.
 */
export async function generateFromPrompt(
  prompt: string,
  formats: ExportFormat[],
  signal?: AbortSignal,
): Promise<GenerationResponse> {
  const bundled = bundledKindForPrompt(prompt)

  try {
    return await callService(
      (remote) => postJson<GenerationResponse>('/api/v1/generate', { prompt, formats }, remote),
      bundled ? PRESET_RACE_TIMEOUT_MS : GENERATION_TIMEOUT_MS,
      signal,
    )
  } catch (error) {
    if (signal?.aborted) throw error
    if (bundled && allowsBundledAnswer(error)) {
      const response = await bundledAnswer(bundled, signal, error)
      response.extractor = 'Bundled demo (24/7 availability fallback)'
      return response
    }
    throw error
  }
}

export function refineModel(
  current_spec: ComponentSpec,
  prompt: string,
  formats: ExportFormat[],
  signal?: AbortSignal,
): Promise<GenerationResponse> {
  return postJson<GenerationResponse>(
    '/api/v1/generate/refine',
    { current_spec, prompt, formats },
    signal,
  )
}

export { isAbort as isAbortError }

