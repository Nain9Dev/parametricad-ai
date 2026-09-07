import { useCallback, useEffect, useState } from 'react'

import { ApiError, fetchCatalog, isAbortError } from '@/lib/apiClient'
import type { Catalog } from '@/types/api'

export type CatalogState =
  | { status: 'loading'; catalog: null; error: null }
  | { status: 'ready'; catalog: Catalog; error: null }
  | { status: 'error'; catalog: null; error: ApiError }

/**
 * Load the capability catalog that the parameter form is built from.
 *
 * Until this resolves there is nothing to render a form from, so the failure
 * path matters: an unreachable backend has to be reported as such rather than
 * leaving an empty panel that looks like a broken build.
 */
export function useCatalog(): CatalogState & { retry: () => void } {
  const [state, setState] = useState<CatalogState>({
    status: 'loading',
    catalog: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', catalog: null, error: null })

    fetchCatalog(controller.signal)
      .then((catalog) => setState({ status: 'ready', catalog, error: null }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setState({
          status: 'error',
          catalog: null,
          error:
            error instanceof ApiError
              ? error
              : new ApiError('The catalog could not be loaded.', {
                  code: 'catalog_unavailable',
                  status: 0,
                }),
        })
      })

    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { ...state, retry }
}
