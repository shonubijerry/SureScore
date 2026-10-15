import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { OtpChallenge } from '../../../lib/types'
import { ErrorNote } from '../../../components/bits'

export const OTP_LENGTH = 6
const inputClass = 'h-12 w-full rounded-2xl border border-input bg-transparent px-4 text-center text-2xl tracking-[0.5em] tabular-nums'

function useSecondsUntil(iso: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000))
}

/** Enter a texted code, with a throttled resend and a way back to change the number. */
export function OtpStep({
  title,
  intro,
  submitLabel,
  challenge,
  onVerify,
  onResend,
  onResent,
  onRestart,
}: {
  title: string
  intro: ReactNode
  submitLabel: string
  challenge: OtpChallenge
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<OtpChallenge>
  onResent: (challenge: OtpChallenge) => void
  onRestart: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const resendIn = useSecondsUntil(challenge.resendAvailableAt)

  async function verify(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onVerify(code)
    } catch (e) {
      setError(e as Error)
      setBusy(false)
    }
  }

  async function resend() {
    setError(null)
    setNotice('')
    try {
      onResent(await onResend())
      setCode('')
      setNotice('A new code is on its way. Earlier codes no longer work.')
    } catch (e) {
      setError(e as Error)
    }
  }

  return (
    <form onSubmit={verify} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Enter the {OTP_LENGTH}-digit code we sent to <strong className="break-all text-foreground">{challenge.sentTo}</strong>. Check your spam
        folder if it hasn&apos;t arrived. {intro}
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Verification code</span>
        <input
          name="code"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${OTP_LENGTH}}`}
          maxLength={OTP_LENGTH}
          className={inputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        />
      </label>
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && <ErrorNote error={error} />}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy || code.length !== OTP_LENGTH}>
        {busy ? 'Verifying…' : submitLabel}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Button type="button" variant="link" className="px-0" onClick={resend} disabled={resendIn > 0}>
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </Button>
        <Button type="button" variant="link" className="px-0 text-muted-foreground" onClick={onRestart}>
          Use a different email
        </Button>
      </div>
    </form>
  )
}
