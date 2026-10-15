import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { isStaffRole, toE164 } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorNote, Section } from '../../../components/bits'
import { useAuth } from '../../auth/auth-context'
import PayoutAccountsPage from '../components/payout-accounts'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  )
}

const inputClass = 'h-10 w-full min-w-0 rounded-2xl border border-input bg-transparent px-3 text-sm'

/** A profile value edited in place; `onSave` receives the trimmed input. */
function EditableRow({
  label,
  value,
  inputProps,
  onSave,
}: {
  label: string
  value: string | null
  inputProps: React.ComponentProps<'input'>
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [error, setError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">{value ?? '—'}</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => {
              setDraft(value ?? '')
              setEditing(true)
            }}
          >
            {value ? 'Change' : 'Add'}
          </Button>
        </dd>
      </div>
    )
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setEditing(false)
    } catch (e) {
      setError(e as Error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <input className={inputClass} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} {...inputProps} />
      </label>
      {error && <ErrorNote error={error} />}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setError(null)
            setEditing(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  const { user, logout, updateProfile } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-8">
      <Section title="Profile">
        <Card size="sm">
          <CardContent className="space-y-4">
            <dl className="space-y-2">
              <EditableRow
                label="Full name"
                value={user.displayName}
                inputProps={{ required: true, minLength: 2, maxLength: 100, autoComplete: 'name' }}
                onSave={(fullName) => updateProfile({ fullName })}
              />
              <Row label="Email" value={user.email ?? '—'} />
              <EditableRow
                label="Phone"
                value={user.phone}
                inputProps={{ type: 'tel', inputMode: 'tel', required: true, autoComplete: 'tel', placeholder: '0801 234 5678' }}
                onSave={async (input) => {
                  const phone = toE164(user.countryCode, input)
                  if (!phone) throw new Error('Enter a valid mobile number.')
                  await updateProfile({ phone })
                }}
              />
              <Row label="Country" value={user.countryCode} />
              <Row label="Role" value={user.role} />
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<Link to="/my-pots" />}>
                My pots
              </Button>
              {isStaffRole(user.role) && (
                <Button variant="outline" size="sm" render={<Link to="/admin" />}>
                  <Shield aria-hidden /> Admin
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={logout}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>
      <PayoutAccountsPage />
    </div>
  )
}
