import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from './api'

interface State<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
}

/**
 * GET `path` (skipped while null). `refreshMs` re-fetches quietly in the
 * background, without flashing the loading state, for live data.
 */
export function useApi<T>(path: string | null, refreshMs?: number) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false })
      return
    }
    const controller = new AbortController()
    let first = true

    const load = () => {
      if (first) setState((s) => ({ ...s, loading: true, error: null }))
      api<T>(path, { signal: controller.signal })
        .then((data) => setState({ data, error: null, loading: false }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          const apiError = error instanceof ApiError ? error : new ApiError(0, 'Network error. Please retry.')
          // Keep showing stale data when only a background refresh fails, but always end loading.
          setState((s) => ({
            data: first ? null : s.data,
            error: apiError,
            loading: false,
          }))
        })
        .finally(() => {
          first = false
        })
    }

    load()
    const timer = refreshMs ? setInterval(load, refreshMs) : undefined
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [path, refreshMs, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
