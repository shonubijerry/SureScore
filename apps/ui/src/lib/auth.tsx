import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore } from './api'
import type { User } from './types'

interface Session {
  token: string
  user: User
}

interface AuthState {
  user: User | null
  /** True until the stored token has been checked. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (input: { email: string; password: string; displayName?: string }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  useEffect(() => {
    if (!tokenStore.get()) return
    api<User>('/api/auth/me')
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const accept = useCallback(({ token, user }: Session) => {
    tokenStore.set(token)
    setUser(user)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => accept(await api<Session>('/api/auth/login', { body: { email, password } })),
      signup: async (input) => accept(await api<Session>('/api/auth/signup', { body: input })),
      logout: () => {
        api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        tokenStore.clear()
        setUser(null)
      },
    }),
    [user, loading, accept],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
