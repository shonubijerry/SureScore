const TOKEN_KEY = 'surescore.token'
const BASE = import.meta.env.VITE_API_URL ?? ''

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** The API answers with JSON `{ error }`, chanfana `{ errors: [{ message }] }` or plain text. */
function errorMessage(status: number, text: string): string {
  try {
    const body = JSON.parse(text)
    return body.error ?? body.errors?.[0]?.message ?? body.message ?? `Request failed (${status})`
  } catch {
    return text || `Request failed (${status})`
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const token = tokenStore.get()
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    signal: options.signal,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, text))
  return JSON.parse(text) as T
}

export const queryString = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]))
  const text = query.toString()
  return text ? `?${text}` : ''
}
