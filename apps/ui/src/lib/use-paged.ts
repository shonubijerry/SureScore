import { useCallback, useEffect, useRef, useState } from 'react'
import { PAGE_FETCH_LIMIT, PAGE_VIEW_SIZE, pageCount, pageSlice, type KeyedPage } from '@surescore/shared'
import { api, ApiError, queryString } from './api'

/** Screen-page state over rows already in memory (see `Pager`). */
export interface Pages<T> {
  /** 0-based page on screen. */
  page: number
  pageCount: number
  pageSize: number
  /** Rows loaded so far (all pages). */
  total: number
  pageItems: T[]
  setPage: (page: number) => void
}

/** `PAGE_VIEW_SIZE` rows per screen page over `items`. */
export function usePages<T>(items: T[], size = PAGE_VIEW_SIZE): Pages<T> {
  const [page, setPage] = useState(0)
  const pages = pageCount(items.length, size)
  const current = Math.min(page, pages - 1)
  return { page: current, pageCount: pages, pageSize: size, total: items.length, pageItems: pageSlice(items, current, size), setPage }
}

export interface Paged<T> extends Pages<T> {
  items: T[]
  loading: boolean
  loadingMore: boolean
  error: ApiError | null
  /** The server has rows beyond those loaded. */
  hasMore: boolean
  /** Fetches the next batch (keyset cursor) and shows its first page. */
  loadMore: () => Promise<void>
  reload: () => void
}

const toError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, 'Network error. Please retry.'))

/**
 * The one list hook: GETs `path` (skipped while null) in batches of `PAGE_FETCH_LIMIT` rows
 * (`{ [key]: rows, nextCursor }`) and shows them `PAGE_VIEW_SIZE` per page. `loadMore` appends
 * the next batch by cursor; changing `path` starts over. `refreshMs` quietly re-fetches the first
 * batch for live data, until the user loads more (later batches would go stale against it).
 */
export function usePaged<T, K extends string = 'items'>(
  path: string | null,
  key: K = 'items' as K,
  { refreshMs }: { refreshMs?: number } = {},
): Paged<T> {
  const [items, setItems] = useState<T[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [version, setVersion] = useState(0)
  const batches = useRef(0)
  const pages = usePages(items)
  const { setPage } = pages

  const url = useCallback(
    (after?: string) => `${path}${path?.includes('?') ? '&' : '?'}${queryString({ limit: String(PAGE_FETCH_LIMIT), cursor: after }).slice(1)}`,
    [path],
  )

  useEffect(() => {
    setPage(0)
    batches.current = 0
    if (path === null) {
      setItems([])
      setCursor(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let first = true

    const load = () => {
      if (!first && batches.current > 1) return
      if (first) {
        setLoading(true)
        setError(null)
      }
      api<KeyedPage<K, T>>(url(), { signal: controller.signal })
        .then((page) => {
          batches.current = Math.max(batches.current, 1)
          setItems(page[key])
          setCursor(page.nextCursor)
          setError(null)
        })
        .catch((e) => {
          if (controller.signal.aborted) return
          // A failed background refresh keeps the rows already on screen.
          if (first) {
            setItems([])
            setCursor(null)
          }
          setError(toError(e))
        })
        .finally(() => {
          if (!controller.signal.aborted && first) setLoading(false)
          first = false
        })
    }

    load()
    const timer = refreshMs ? setInterval(load, refreshMs) : undefined
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [path, url, key, refreshMs, version, setPage])

  const loadMore = useCallback(async () => {
    if (!cursor) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await api<KeyedPage<K, T>>(url(cursor))
      batches.current += 1
      setPage(Math.floor(items.length / pages.pageSize))
      setItems((current) => [...current, ...page[key]])
      setCursor(page.nextCursor)
    } catch (e) {
      setError(toError(e))
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, url, key, items.length, pages.pageSize, setPage])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...pages, items, loading, loadingMore, error, hasMore: cursor !== null, loadMore, reload }
}
