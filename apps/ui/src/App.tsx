import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loading } from './components/bits'
import { Layout, RequireAuth } from './components/layout'
import { AuthProvider } from './lib/auth'

// Route-level code splitting keeps the first load small on mobile networks.
const HomePage = lazy(() => import('./pages/home'))
const PotsPage = lazy(() => import('./pages/pots'))
const MyPotsPage = lazy(() => import('./pages/my-pots'))
const MatchesPage = lazy(() => import('./pages/matches'))
const MatchDetailPage = lazy(() => import('./pages/match-detail'))
const PotDetailPage = lazy(() => import('./pages/pot-detail'))
const CreatePotPage = lazy(() => import('./pages/create-pot'))
const AdminLayout = lazy(() => import('./pages/admin/layout').then((m) => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('./pages/admin/dashboard'))
const AdminPotList = lazy(() => import('./pages/admin/pots').then((m) => ({ default: m.PotList })))
const AdminPotDetail = lazy(() => import('./pages/admin/pots').then((m) => ({ default: m.PotDetail })))
const AdminTransfers = lazy(() => import('./pages/admin/transfers'))
const AdminLedger = lazy(() => import('./pages/admin/ledger'))
const AdminReconciliation = lazy(() => import('./pages/admin/reconciliation'))
const AdminStaff = lazy(() => import('./pages/admin/staff'))
const AdminAudit = lazy(() => import('./pages/admin/audit'))
const FaqPage = lazy(() => import('./pages/faq'))
const AuthPage = lazy(() => import('./pages/auth'))
const ProfilePage = lazy(() => import('./pages/profile'))

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
              <Route path="faq" element={<FaqPage />} />
              <Route path="login" element={<AuthPage mode="login" />} />
              <Route path="signup" element={<AuthPage mode="signup" />} />
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
