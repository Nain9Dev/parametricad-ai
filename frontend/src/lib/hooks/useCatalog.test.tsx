import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/apiClient'
import { fetchCatalogWithRetry } from '@/lib/apiClient'
import { useCatalog } from '@/lib/hooks/useCatalog'
import type { Catalog } from '@/types/api'

// @req REQ-EVT-04
// @req REQ-STA-03

vi.mock('@/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiClient')>()
  return { ...actual, fetchCatalogWithRetry: vi.fn() }
})

const mockedFetch = vi.mocked(fetchCatalogWithRetry)

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

describe('useCatalog', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('REQ-EVT-04: reports the catalog once it loads', async () => {
    mockedFetch.mockResolvedValueOnce(catalog)

    const { result } = renderHook(() => useCatalog())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.catalog).toEqual(catalog)
  })

  it('REQ-EVT-04: surfaces a failure the backend described', async () => {
    mockedFetch.mockRejectedValueOnce(
      new ApiError('bad spec', { code: 'invalid_parameters', status: 422 }),
    )

    const { result } = renderHook(() => useCatalog())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error?.code).toBe('invalid_parameters')
  })

  it('REQ-STA-03: discloses a slow first load', async () => {
    vi.useFakeTimers()
    try {
      mockedFetch.mockReturnValueOnce(new Promise<Catalog>(() => {}))

      const { result } = renderHook(() => useCatalog())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_500)
      })

      expect(result.current.slow).toBe(true)
      expect(result.current.status).toBe('loading')
    } finally {
      vi.useRealTimers()
    }
  })
})
