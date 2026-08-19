import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AffiliateRegisterScreen from '@/screens/affiliate/AffiliateRegisterScreen'
import AffiliateDashboardScreen from '@/screens/affiliate/AffiliateDashboardScreen'
import BeliLandingScreen from '@/screens/affiliate/BeliLandingScreen'
import './index.css'

// Three public, unauthenticated routes live outside App.tsx's auth gate —
// affiliates are a separate identity from signed-in Bernafas users (see
// supabase/migrations/0003_affiliate_program.sql's header comment), and
// /beli must be reachable by anyone clicking a shared affiliate link
// without ever hitting AuthScreen. A plain pathname check here (no router
// dependency) is enough for 3 fixed paths — everything else falls through
// to the existing tab-based <App/> shell untouched. vercel.json's SPA
// rewrite is what makes a direct hit to any of these (not just in-app
// navigation) actually reach this bundle instead of 404ing.
function PublicRoot() {
  const { pathname } = window.location

  if (pathname === '/affiliate/daftar') return <AffiliateRegisterScreen />

  const dashboardMatch = pathname.match(/^\/affiliate\/dashboard\/([^/]+)$/)
  if (dashboardMatch) return <AffiliateDashboardScreen affiliateId={dashboardMatch[1]} />

  if (pathname === '/beli') return <BeliLandingScreen />

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicRoot />
  </StrictMode>,
)
