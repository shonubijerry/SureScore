import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, queryString } from './api'

interface Page<T> {
  matches: T[]
  nextCursor: string | null
}

/**
 * Cursor-paged GET of `path` (`{ matches, nextCursor }`), `pageSize` at a time.
 * `loadMore` appends the next page; changing `path` starts over.
 */
export function usePagedMatches<T>(path: string, pageSize: number) {
  const [items, setItems] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [version, setVersion] = useState(0)

  const url = useCallback(
    (after?: string) => `${path}${path.includes('?') ? '&' : '?'}${queryString({ limit: String(pageSize), cursor: after }).slice(1)}`,
    [path, pageSize],
  )
  const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, 'Network error. Please retry.'))

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    api<Page<T>>(url(), { signal: controller.signal })
      .then((page) => {
        setItems(page.matches)
        setCursor(page.nextCursor)
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        setItems([])
        setCursor(null)
        setError(toError(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [url, version])

  const loadMore = useCallback(async () => {
    if (!cursor) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await api<Page<T>>(url(cursor))
      setItems((current) => [...current, ...page.matches])
      setCursor(page.nextCursor)
    } catch (e) {
      setError(toError(e))
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, url])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { items, loading, loadingMore, error, hasMore: cursor !== null, loadMore, reload }
}
