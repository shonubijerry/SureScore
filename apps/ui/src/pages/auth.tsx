import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '../components/bits'
import { useAuth } from '../lib/auth'

const inputClass = 'h-12 w-full rounded-2xl border border-input bg-transparent px-4'

function Field({ label, ...props }: { label: string } & React.ComponentProps<'input'>) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      <input className={inputClass} {...props} />
    </label>
  )
}

/** Login and signup share one form; signup adds a display name (country is detected by the server). */
export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await login(field('email'), String(form.get('password')))
      else
        await signup({
          email: field('email'),
          password: String(form.get('password')),
          displayName: field('displayName') || undefined,
        })
      navigate(from, { replace: true })
    } catch (e) {
      setError(e as Error)
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-black">{isLogin ? 'Sign in' : 'Create account'}</h1>
      {!isLogin && <Field label="Display name" name="displayName" autoComplete="nickname" />}
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field label="Password" name="password" type="password" required minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
      {error && <ErrorNote error={error} />}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
        {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Sign up'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? 'New here?' : 'Already have an account?'}{' '}
        <Link to={isLogin ? '/signup' : '/login'} state={{ from }} className="font-semibold underline">
          {isLogin ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
    </form>
  )
}
