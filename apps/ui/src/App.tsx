import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
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
const AuthPage = lazy(() => import('./pages/auth'))

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
              <Route path="login" element={<AuthPage mode="login" />} />
              <Route path="signup" element={<AuthPage mode="signup" />} />
              <Route element={<RequireAuth />}>
                <Route path="my-pots" element={<MyPotsPage />} />
                <Route path="pots/new" element={<CreatePotPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
