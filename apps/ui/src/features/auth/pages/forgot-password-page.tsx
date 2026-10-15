import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorNote } from '../../../components/bits'
import { OtpStep } from '../components/otp-step'
import { useAuth } from '../auth-context'
import type { OtpChallenge } from '../../../lib/types'

const inputClass = 'h-12 w-full rounded-2xl border border-input bg-transparent px-4'

/** Email -> emailed code -> new password. Setting the password signs out other devices and signs in here. */
export default function ForgotPasswordPage() {
  const { user, requestPasswordReset, resendResetCode, verifyResetCode, resetPassword } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [busy, setBusy] = useState(false)

  if (user && !resetToken) return <Navigate to={from} replace />

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  if (resetToken) {
    const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const password = String(form.get('password'))
      if (password !== String(form.get('confirm'))) {
        setError(new Error('The passwords do not match.'))
        return
      }
      void run(async () => {
        await resetPassword(resetToken, password)
        navigate(from, { replace: true })
      })
    }
    return (
      <form onSubmit={submit} className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-black">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">You'll be signed out on other devices.</p>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">New password</span>
          <input className={inputClass} name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Confirm new password</span>
          <input className={inputClass} name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {error && <ErrorNote error={error} />}
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
          {busy ? 'Saving…' : 'Save password & sign in'}
        </Button>
      </form>
    )
  }

  if (challenge) {
    return (
      <OtpStep
        title="Reset your password"
        intro="Once it's confirmed you can choose a new password."
        submitLabel="Verify code"
        challenge={challenge}
        onVerify={async (code) => setResetToken(await verifyResetCode(challenge.sentTo, code))}
        onResend={() => resendResetCode(challenge.sentTo)}
        onResent={setChallenge}
        onRestart={() => setChallenge(null)}
      />
    )
  }

  const start = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    void run(async () => setChallenge(await requestPasswordReset(email)))
  }

  return (
    <form onSubmit={start} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-black">Forgot password</h1>
      <p className="text-sm text-muted-foreground">Enter your account's email and we'll send you a code to reset your password.</p>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Email</span>
        <input className={inputClass} name="email" type="email" required autoComplete="email" inputMode="email" autoFocus />
      </label>
      {error && <ErrorNote error={error} />}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
        {busy ? 'Please wait…' : 'Send code'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" state={{ from }} className="font-semibold underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
