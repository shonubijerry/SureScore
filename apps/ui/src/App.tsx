import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loading } from './components/bits'
import { Layout, RequireAuth } from './components/layout'
import { AuthProvider } from './features/auth/auth-context'

// Route-level code splitting keeps the first load small on mobile networks.
const HomePage = lazy(() => import('./features/home/pages/home-page'))
const PotsPage = lazy(() => import('./features/pots/pages/public-pots-page'))
const MyPotsPage = lazy(() => import('./features/pots/pages/my-pots-page'))
const MatchesPage = lazy(() => import('./features/matches/pages/matches-page'))
const MatchDetailPage = lazy(() => import('./features/matches/pages/match-detail-page'))
const PotDetailPage = lazy(() => import('./features/pots/pages/pot-detail-page'))
const CreatePotPage = lazy(() => import('./features/pots/pages/create-pot-page'))
const AdminLayout = lazy(() => import('./features/admin/components/admin-layout').then((m) => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('./features/admin/pages/dashboard-page'))
const AdminPotList = lazy(() => import('./features/admin/pages/pots-page').then((m) => ({ default: m.PotList })))
const AdminPotDetail = lazy(() => import('./features/admin/pages/pots-page').then((m) => ({ default: m.PotDetail })))
const AdminTransfers = lazy(() => import('./features/admin/pages/transfers-page'))
const AdminLedger = lazy(() => import('./features/admin/pages/ledger-page'))
const AdminReconciliation = lazy(() => import('./features/admin/pages/reconciliation-page'))
const AdminStaff = lazy(() => import('./features/admin/pages/staff-page'))
const AdminAudit = lazy(() => import('./features/admin/pages/audit-page'))
const FaqPage = lazy(() => import('./features/help/pages/faq-page'))
const LeaguePage = lazy(() => import('./features/matches/pages/league-page'))
const AuthPage = lazy(() => import('./features/auth/pages/auth-page'))
const ForgotPasswordPage = lazy(() => import('./features/auth/pages/forgot-password-page'))
const ProfilePage = lazy(() => import('./features/account/pages/profile-page'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="matches/:id" element={<MatchDetailPage />} />
              <Route path="pots" element={<PotsPage />} />
              <Route path="pots/:id" element={<PotDetailPage />} />
              <Route path="leagues/:code" element={<LeaguePage />} />
              <Route path="faq" element={<FaqPage />} />
              <Route path="login" element={<AuthPage mode="login" />} />
              <Route path="signup" element={<AuthPage mode="signup" />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route element={<RequireAuth />}>
                <Route path="my-pots" element={<MyPotsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="payout-accounts" element={<Navigate to="/profile" replace />} />
                <Route path="pots/new" element={<CreatePotPage />} />
              </Route>
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="pots" element={<AdminPotList />} />
                <Route path="pots/:id" element={<AdminPotDetail />} />
                <Route path="payouts" element={<AdminTransfers type="payouts" />} />
                <Route path="refunds" element={<AdminTransfers type="refunds" />} />
                <Route path="ledger" element={<AdminLedger />} />
                <Route path="reconciliation" element={<AdminReconciliation />} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="audit" element={<AdminAudit />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
