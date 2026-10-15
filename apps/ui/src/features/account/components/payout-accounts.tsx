import { useState } from 'react'
import { Building2, Check, CreditCard, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { getBankName } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, ErrorNote, Loading, Section } from '../../../components/bits'
import { PayoutAccountModal } from './payout-account-modal'
import { api } from '../../../lib/api'
import type { PayoutAccount } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'

export default function PayoutAccountsPage() {
  const query = useApi<{ payoutAccounts: PayoutAccount[] }>('/api/payout-accounts')
  const accounts = query.data?.payoutAccounts ?? []

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<PayoutAccount | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<Error | null>(null)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  async function handleSetDefault(id: string) {
    setSettingDefaultId(id)
    setActionError(null)
    try {
      await api(`/api/payout-accounts/${id}`, {
        method: 'PATCH',
        body: { isDefault: true },
      })
      query.reload()
    } catch (err) {
      setActionError(err as Error)
    } finally {
      setSettingDefaultId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to remove this payout account?')) {
      return
    }
    setDeletingId(id)
    setActionError(null)
    try {
      await api(`/api/payout-accounts/${id}`, { method: 'DELETE' })
      query.reload()
    } catch (err) {
      setActionError(err as Error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Payout accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage your bank accounts. Winnings from your predictions are paid directly to your active account.
          </p>
        </div>
        <Button onClick={() => { setEditingAccount(null); setModalOpen(true) }} className="gap-2">
          <Plus className="size-4" /> Add Payout Account
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 text-primary" />
        <p>
          <strong className="text-foreground">Security & Fraud Protection:</strong> Account numbers are encrypted at rest with AES-256-GCM. The account holder's name must match your registered name.
        </p>
      </div>

      {actionError && <ErrorNote error={actionError} />}

      <Section title="Your accounts">
        {query.loading ? (
          <Loading />
        ) : query.error ? (
          <ErrorNote error={query.error} onRetry={query.reload} />
        ) : accounts.length === 0 ? (
          <Empty>
            You have no payout accounts yet.{' '}
            <button
              type="button"
              onClick={() => { setEditingAccount(null); setModalOpen(true) }}
              className="font-semibold underline ml-1"
            >
              Add your bank account
            </button>{' '}
            to start predicting and receive winnings.
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((acc) => {
              const bankName = getBankName(acc.bankCode) ?? (acc.bankCode ? `Bank ${acc.bankCode}` : 'Bank Account')
              return (
                <Card key={acc.id} className="relative transition-all">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                          <Building2 className="size-5" />
                        </div>
                        <div>
                          <p className="font-bold">{acc.accountName}</p>
                          <p className="text-xs text-muted-foreground">{bankName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {acc.isDefault ? (
                          <Badge variant="default" className="bg-emerald-600 dark:bg-emerald-500 text-white gap-1">
                            <Check className="size-3" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                        {acc.isVerified && (
                          <Badge variant="secondary" className="text-[10px]">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm font-mono tracking-wider">
                      <CreditCard className="size-4 text-muted-foreground" />
                      <span>{acc.accountNumber}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                      {!acc.isDefault ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={settingDefaultId === acc.id}
                          onClick={() => handleSetDefault(acc.id)}
                        >
                          {settingDefaultId === acc.id ? 'Setting…' : 'Set as Active'}
                        </Button>
                      ) : (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Active payout account
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingAccount(acc)
                            setModalOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === acc.id}
                          onClick={() => handleDelete(acc.id)}
                          aria-label="Remove account"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      <PayoutAccountModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          query.reload()
        }}
        accountToEdit={editingAccount}
      />
    </div>
  )
}
