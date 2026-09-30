import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, absoluteUrl, fetchCatalogWithRetry } from '@/lib/apiClient'
import type { Catalog } from '@/types/api'

// @req REQ-EVT-04

const catalog: Catalog = {
  components: [],
  materials: [],
  formats: [],
  tessellation: {
    linear_deflection_mm: 0.1,
    angular_deflection_rad: 0.1,
    weld_tolerance_mm: 0.01,
  },
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('ApiError.isRetryable', () => {
  it('is true for transport and server overload failures', () => {
    expect(new ApiError('x', { code: 'network_unreachable', status: 0 }).isRetryable).toBe(true)
    expect(new ApiError('x', { code: 'capacity_exhausted', status: 503 }).isRetryable).toBe(true)
    expect(new ApiError('x', { code: 'boom', status: 500 }).isRetryable).toBe(true)
  })

  it('is false for a client or domain failure', () => {
    expect(new ApiError('x', { code: 'invalid_parameters', status: 422 }).isRetryable).toBe(false)
    expect(new ApiError('x', { code: 'parameter_extraction_failed', status: 400 }).isRetryable).toBe(
      false,
    )
  })
})

describe('absoluteUrl', () => {
  it('resolves an API-relative path against the base URL', () => {
    expect(absoluteUrl('/api/v1/catalog')).toBe('http://localhost:8130/api/v1/catalog')
  })
})

describe('fetchCatalogWithRetry', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  afterEach(() => {
    fetchMock.mockReset()
    vi.useRealTimers()
  })

  it('retries a transport failure with backoff and eventually loads', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(response(200, catalog))

    const promise = fetchCatalogWithRetry(new AbortController().signal)
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toEqual(catalog)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('surfaces a non-retryable failure without retrying', async () => {
    fetchMock.mockResolvedValueOnce(
      response(422, {
        error: { code: 'invalid_parameters', message: 'x', hint: null, details: {} },
      }),
    )

    await expect(fetchCatalogWithRetry(new AbortController().signal)).rejects.toMatchObject({
      code: 'invalid_parameters',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
