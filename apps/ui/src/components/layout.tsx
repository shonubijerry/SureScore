import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, CircleHelp, Home, LogIn, Shield, Trophy, Wallet } from 'lucide-react'
import { isStaffRole } from '@surescore/shared'
import { Button } from '@/components/ui/button'
import { useAuth } from '../lib/auth'
import { Loading } from './bits'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/matches', label: 'Matches', icon: CalendarDays },
  { to: '/pots', label: 'Pots', icon: Trophy },
  { to: '/my-pots', label: 'My Pots', icon: Wallet },
]

const ADMIN_NAV = { to: '/admin', label: 'Admin', icon: Shield, end: false }

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs md:flex-row md:gap-2 md:text-sm ${
    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  }`

/** Top bar on wide screens, fixed bottom tab bar on phones. */
export function Layout() {
  const { user, logout } = useAuth()
  const nav = isStaffRole(user?.role) ? [...NAV, ADMIN_NAV] : NAV
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-xl font-black tracking-tight text-foreground">
            SureScore
          </Link>
          <nav className="hidden gap-2 md:flex">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
          <Link to="/faq" aria-label="FAQ" className="ml-auto text-muted-foreground hover:text-foreground">
            <CircleHelp aria-hidden className="size-5" />
          </Link>
          {user ? (
            <Button variant="outline" size="sm" onClick={logout}>
              Sign out
            </Button>
          ) : (
            <Link to="/login" className="flex items-center gap-1 text-sm font-semibold">
              <LogIn aria-hidden className="size-4" /> Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon aria-hidden className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Sends signed-out visitors to /login and back again afterwards. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
