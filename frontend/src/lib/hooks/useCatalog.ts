import { useCallback, useEffect, useState } from 'react'

import { asApiError, fetchCatalogWithRetry, isAbortError } from '@/lib/apiClient'
import type { ApiError } from '@/lib/apiClient'
import type { Catalog } from '@/types/api'

/**
 * How long a first load may stay silent before the wait is explained.
 *
 * The hosted demo runs on an instance that suspends when idle, and the request
 * that wakes it can take most of a minute. An unmoving skeleton for that long
 * reads as a broken deploy, so past this point the interface says what is
 * happening instead of leaving the user to guess.
 */
const SLOW_LOAD_MS = 3_500

export type CatalogState =
  | { status: 'loading'; catalog: null; error: null }
  | { status: 'ready'; catalog: Catalog; error: null }
  | { status: 'error'; catalog: null; error: ApiError }

export type CatalogController = CatalogState & {
  /** The first load is still pending and has been for long enough to say so. */
  slow: boolean
  retry: () => void
}

/**
 * Load the capability catalog that the parameter form is built from.
 *
 * Until this resolves there is nothing to render a form from, so both failure
 * paths matter: the retry with growing backoff happens inside
 * `fetchCatalogWithRetry` (see `@/lib/apiClient`), and this hook only turns
 * the outcome into the state the interface renders.
 */
export function useCatalog(): CatalogController {
  const [state, setState] = useState<CatalogState>({
    status: 'loading',
    catalog: null,
    error: null,
  })
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', catalog: null, error: null })
    setSlow(false)

    const slowTimer = setTimeout(() => setSlow(true), SLOW_LOAD_MS)
    const settle = (next: CatalogState) => {
      clearTimeout(slowTimer)
      setState(next)
    }

    fetchCatalogWithRetry(controller.signal)
      .then((catalog) => settle({ status: 'ready', catalog, error: null }))
      .catch((cause: unknown) => {
        if (isAbortError(cause) || controller.signal.aborted) return
        settle({ status: 'error', catalog: null, error: asApiError(cause) })
      })

    return () => {
      controller.abort()
      clearTimeout(slowTimer)
    }
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { ...state, slow, retry }
}
