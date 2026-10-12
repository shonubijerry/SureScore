import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Activity, ArrowLeft, BookOpen, ClipboardList, Landmark, RotateCcw, Scale, ScrollText, Send, Users } from 'lucide-react'
import { isStaffRole, type Permission } from '@surescore/shared'
import { Loading } from '../../components/bits'
import { useAuth } from '../../lib/auth'
import { useCan } from './kit'

const NAV: { to: string; label: string; icon: typeof Activity; permission: Permission; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: Activity, permission: 'dashboard.view', end: true },
  { to: '/admin/pots', label: 'Pots', icon: Landmark, permission: 'pots.view' },
  { to: '/admin/payouts', label: 'Payouts', icon: Send, permission: 'transfers.view' },
  { to: '/admin/refunds', label: 'Refunds', icon: RotateCcw, permission: 'transfers.view' },
  { to: '/admin/ledger', label: 'Ledger', icon: BookOpen, permission: 'ledger.view' },
  { to: '/admin/reconciliation', label: 'Reconciliation', icon: Scale, permission: 'reconciliation.view' },
  { to: '/admin/staff', label: 'Staff', icon: Users, permission: 'staff.view' },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`

/** Back-office shell: sidebar on desktop, scrollable tab strip on phones. Only permitted sections are listed. */
export function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const can = useCan()
  if (loading) return <Loading />
  if (!isStaffRole(user?.role)) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-border bg-background md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-black tracking-tight">
              <ClipboardList aria-hidden className="size-5" /> SureScore Admin
            </p>
            <p className="text-xs capitalize text-muted-foreground">
              {user?.email} · {user?.role}
            </p>
          </div>
        </div>
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {NAV.filter((item) => can(item.permission)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon aria-hidden className="size-4" />
              {label}
            </NavLink>
          ))}
          <NavLink to="/" className={linkClass}>
            <ArrowLeft aria-hidden className="size-4" /> Back to app
          </NavLink>
          <button type="button" onClick={logout} className="shrink-0 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
            Sign out
          </button>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 space-y-6 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  )
}
