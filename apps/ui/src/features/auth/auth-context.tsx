import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore } from '../../lib/api'
import type { OtpChallenge, User } from '../../lib/types'

interface Session {
  token: string
  user: User
}

interface AuthState {
  user: User | null
  /** True until the stored token has been checked. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  /** Emails a code; the account exists only once `verifySignup` succeeds. */
  signup: (input: { fullName: string; email: string; phone: string; password: string }) => Promise<OtpChallenge>
  resendCode: (email: string) => Promise<OtpChallenge>
  verifySignup: (email: string, code: string) => Promise<void>
  updateProfile: (input: { fullName?: string; phone?: string }) => Promise<void>
  /** Forgot password: emails a code, then a valid code yields a token for setting the new password (which signs in). */
  requestPasswordReset: (email: string) => Promise<OtpChallenge>
  resendResetCode: (email: string) => Promise<OtpChallenge>
  verifyResetCode: (email: string, code: string) => Promise<string>
  resetPassword: (resetToken: string, password: string) => Promise<void>
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
      signup: (input) => api<OtpChallenge>('/api/auth/signup', { body: input }),
      resendCode: (email) => api<OtpChallenge>('/api/auth/signup/resend', { body: { email } }),
      verifySignup: async (email, code) => accept(await api<Session>('/api/auth/signup/verify', { body: { email, code } })),
      updateProfile: async (input) => setUser(await api<User>('/api/auth/me', { method: 'PATCH', body: input })),
      requestPasswordReset: (email) => api<OtpChallenge>('/api/auth/password/forgot', { body: { email } }),
      resendResetCode: (email) => api<OtpChallenge>('/api/auth/password/forgot/resend', { body: { email } }),
      verifyResetCode: async (email, code) =>
        (await api<{ resetToken: string }>('/api/auth/password/verify', { body: { email, code } })).resetToken,
      resetPassword: async (resetToken, password) => accept(await api<Session>('/api/auth/password/reset', { body: { resetToken, password } })),
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
