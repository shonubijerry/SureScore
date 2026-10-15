import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { isStaffRole } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Section } from '../components/bits'
import { useAuth } from '../lib/auth'
import PayoutAccountsPage from './payout-accounts'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="space-y-8">
      <Section title="Profile">
        <Card size="sm">
          <CardContent className="space-y-4">
            <dl className="space-y-2">
              <Row label="Name" value={user.displayName ?? '—'} />
              <Row label="Email" value={user.email} />
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
