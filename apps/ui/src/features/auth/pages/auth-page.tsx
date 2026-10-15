import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '../../../components/bits'
import { OtpStep } from '../components/otp-step'
import { PhoneField } from '../../../components/phone-field'
import { useAuth } from '../auth-context'
import type { OtpChallenge } from '../../../lib/types'

const inputClass = 'h-12 w-full rounded-2xl border border-input bg-transparent px-4'

function Field({ label, ...props }: { label: string } & React.ComponentProps<'input'>) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-semibold">{label}</span>
      <input className={inputClass} {...props} />
    </label>
  )
}

// The code step survives a refresh, so a signup can't be skipped past or lost mid-way.
const PENDING_KEY = 'surescore.pendingSignup'
const pendingSignup = {
  get: (): OtpChallenge | null => {
    try {
      const challenge = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as OtpChallenge | null
      // Ignore expired or older-format (phone) pending signups.
      return challenge?.sentTo && new Date(challenge.expiresAt).getTime() > Date.now() ? challenge : null
    } catch {
      return null
    }
  },
  set: (challenge: OtpChallenge) => {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(challenge))
    } catch {
      // Storage unavailable (private mode): the step still works until reload.
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      // ignore
    }
  },
}

/** Sign in with email + password; signup adds a full name and phone, and verifies the email with a code (country is detected by the server). */
export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, login, signup, verifySignup, resendCode } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [phone, setPhone] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<OtpChallenge | null>(() => (mode === 'signup' ? pendingSignup.get() : null))
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  const isLogin = mode === 'login'
  const awaitCode = (next: OtpChallenge | null) => {
    if (next) pendingSignup.set(next)
    else pendingSignup.clear()
    setChallenge(next)
  }

  if (!isLogin && challenge) {
    return (
      <OtpStep
        title="Verify your email"
        intro="Your account is created once your email is verified."
        submitLabel="Verify & create account"
        challenge={challenge}
        onVerify={async (code) => {
          await verifySignup(challenge.sentTo, code)
          pendingSignup.clear()
          navigate(from, { replace: true })
        }}
        onResend={() => resendCode(challenge.sentTo)}
        onResent={awaitCode}
        onRestart={() => awaitCode(null)}
      />
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isLogin && !phone) {
      setError(new Error('Enter a valid mobile number.'))
      return
    }
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password'))
    setBusy(true)
    setError(null)
    try {
      if (isLogin) {
        await login(email, password)
        navigate(from, { replace: true })
      } else {
        awaitCode(await signup({ fullName: String(form.get('fullName') ?? '').trim(), email, phone: phone!, password }))
        setBusy(false)
      }
    } catch (e) {
      setError(e as Error)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-black">{isLogin ? 'Sign in' : 'Create account'}</h1>
      {!isLogin && <Field label="Full name" name="fullName" required minLength={2} autoComplete="name" />}
      <Field label="Email" name="email" type="email" required autoComplete="email" inputMode="email" />
      {!isLogin && <PhoneField onChange={setPhone} />}
      <Field label="Password" name="password" type="password" required minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} />
      {isLogin && (
        <p className="-mt-2 text-right text-sm">
          <Link to="/forgot-password" state={{ from }} className="font-semibold text-muted-foreground underline">
            Forgot password?
          </Link>
        </p>
      )}
      {error && <ErrorNote error={error} />}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
        {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Send verification code'}
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
