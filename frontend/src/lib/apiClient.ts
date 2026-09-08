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

import type {
  ApiErrorResponse,
  Catalog,
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
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`
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
    throw new ApiError('Could not reach the generation service.', {
      code: 'network_unreachable',
      status: 0,
      hint: 'Check that the backend is running and reachable from this origin.',
    })
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

export function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  return request<Catalog>('/api/v1/catalog', signal ? { signal } : {})
}

export function generateFromSpec(
  spec: ComponentSpec,
  formats: ExportFormat[],
  signal?: AbortSignal,
): Promise<GenerationResponse> {
  return postJson<GenerationResponse>('/api/v1/models', { spec, formats }, signal)
}

export function generateFromPrompt(
  prompt: string,
  formats: ExportFormat[],
  signal?: AbortSignal,
): Promise<GenerationResponse> {
  return postJson<GenerationResponse>('/api/v1/generate', { prompt, formats }, signal)
}

export { isAbort as isAbortError }
