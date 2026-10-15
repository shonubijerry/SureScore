import { useState, useEffect, type FormEvent } from 'react'
import { isNameMatching, NIGERIAN_BANKS } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Modal } from './modal'
import { ErrorNote } from './bits'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PayoutAccount } from '../lib/types'

const inputClass = 'h-12 w-full rounded-2xl border border-input bg-transparent px-4 text-sm'

export function PayoutAccountModal({
  isOpen,
  onClose,
  onSuccess,
  accountToEdit = null,
  title,
  subtitle,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: (account: PayoutAccount) => void
  accountToEdit?: PayoutAccount | null
  title?: string
  subtitle?: string
}) {
  const { user } = useAuth()
  const isEditing = Boolean(accountToEdit)

  const [accountName, setAccountName] = useState('')
  const [bankCode, setBankCode] = useState(NIGERIAN_BANKS[0]?.code ?? '')
  const [accountNumber, setAccountNumber] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (accountToEdit) {
      setAccountName(accountToEdit.accountName)
      setBankCode(accountToEdit.bankCode ?? NIGERIAN_BANKS[0]?.code ?? '')
      setAccountNumber('') // Leave blank so we don't accidentally send masked number
      setIsDefault(accountToEdit.isDefault)
    } else {
      setAccountName(user?.displayName ?? '')
      setBankCode(NIGERIAN_BANKS[0]?.code ?? '')
      setAccountNumber('')
      setIsDefault(true)
    }
    setError(null)
  }, [accountToEdit, user, isOpen])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedName = accountName.trim()
    const trimmedNumber = accountNumber.trim()

    if (!trimmedName) {
      setError(new Error('Account name is required.'))
      return
    }

    if (!isEditing && !trimmedNumber) {
      setError(new Error('Account number is required.'))
      return
    }

    if (trimmedNumber && !/^\d{10}$/.test(trimmedNumber)) {
      setError(new Error('Account number must be 10 digits.'))
      return
    }

    // Name matching validation
    if (user?.displayName && !isNameMatching(trimmedName, user.displayName)) {
      setError(
        new Error(
          `Account name ("${trimmedName}") must match your registered name ("${user.displayName}").`
        )
      )
      return
    }

    setSaving(true)
    try {
      if (isEditing && accountToEdit) {
        const body: Record<string, unknown> = {
          accountName: trimmedName,
          bankCode: bankCode || undefined,
          isDefault,
        }
        if (trimmedNumber) {
          body.accountNumber = trimmedNumber
        }
        const res = await api<{ payoutAccount: PayoutAccount }>(
          `/api/payout-accounts/${accountToEdit.id}`,
          {
            method: 'PATCH',
            body,
          }
        )
        onSuccess(res.payoutAccount)
      } else {
        const res = await api<{ payoutAccount: PayoutAccount }>('/api/payout-accounts', {
          method: 'POST',
          body: {
            accountName: trimmedName,
            accountNumber: trimmedNumber,
            bankCode: bankCode || undefined,
          },
        })
        onSuccess(res.payoutAccount)
      }
      onClose()
    } catch (err) {
      setError(err as Error)
    } finally {
      setSaving(false)
    }
  }

  const modalTitle = title ?? (isEditing ? 'Edit Payout Account' : 'Add Payout Account')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Account Name</span>
          <input
            type="text"
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="e.g. John Doe"
            className={inputClass}
          />
          {user?.displayName ? (
            <span className="block text-xs text-muted-foreground">
              Must match your registered name: <strong className="text-foreground">{user.displayName}</strong>
            </span>
          ) : (
            <span className="block text-xs text-muted-foreground">
              This name will be saved as your registered account name.
            </span>
          )}
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Bank</span>
          <select
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            className={inputClass}
          >
            {NIGERIAN_BANKS.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">Account Number</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            required={!isEditing}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
            placeholder={isEditing ? 'Leave blank to keep existing number' : '10-digit NUBAN'}
            className={inputClass}
          />
          <span className="block text-xs text-muted-foreground">
            {isEditing
              ? `Currently: ${accountToEdit?.accountNumber}. Only enter if updating.`
              : 'Stored encrypted for your security.'}
          </span>
        </label>

        {isEditing && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <span className="font-medium">Set as active (default) payout account</span>
          </label>
        )}

        {error && <ErrorNote error={error} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Account'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
