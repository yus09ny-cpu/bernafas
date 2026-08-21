import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AffiliateRegisterScreen from '@/screens/affiliate/AffiliateRegisterScreen'
import AffiliateDashboardScreen from '@/screens/affiliate/AffiliateDashboardScreen'
import AffiliateLoginScreen from '@/screens/affiliate/AffiliateLoginScreen'
import AffiliateResetPasswordScreen from '@/screens/affiliate/AffiliateResetPasswordScreen'
import BeliLandingScreen from '@/screens/affiliate/BeliLandingScreen'
import { consumeAffiliateOAuthRedirect } from '@/lib/affiliate'
import AdminShippingScreen from '@/screens/admin/AdminShippingScreen'
import AdminManagementScreen from '@/screens/admin/AdminManagementScreen'
import PaymentSuccessScreen from '@/screens/PaymentSuccessScreen'
import './index.css'

// Public/side-gate routes live outside App.tsx's auth+app-access gate —
// affiliates are a separate identity from signed-in Bernafas users (see
// supabase/migrations/0003_affiliate_program.sql's header comment), and
// /beli must be reachable by anyone clicking a shared affiliate link
// without ever hitting AuthScreen. /admin/penghantaran is a DIFFERENT kind
// of exception — it needs auth (does its own via useAuth), just not
// App.tsx's app-access subscription gate (an admin managing shipments has
// nothing to do with their own subscription status). A plain pathname
// check here (no router dependency) is enough for this fixed set of
// paths — everything else falls through to the existing tab-based <App/>
// shell untouched. vercel.json's SPA rewrite is what makes a direct hit to
// any of these (not just in-app navigation) actually reach this bundle
// instead of 404ing.
function PublicRoot() {
  const { pathname } = window.location

  // Google OAuth started from /affiliate/log-masuk always redirects back
  // to bare `/` (see src/lib/affiliate.ts's markAffiliateOAuthRedirect
  // comment for why) — bounce back to the login screen, carrying the
  // OAuth callback params (?code=/#access_token=...) along so the
  // Supabase client re-initialized there still completes session
  // detection instead of on this discarded `/` load.
  const oauthBounce = consumeAffiliateOAuthRedirect(pathname)
  if (oauthBounce) {
    window.location.replace(oauthBounce)
    return null
  }

  if (pathname === '/affiliate/daftar') return <AffiliateRegisterScreen />
  if (pathname === '/affiliate/log-masuk') return <AffiliateLoginScreen />
  if (pathname === '/affiliate/reset-kata-laluan') return <AffiliateResetPasswordScreen />

  const dashboardMatch = pathname.match(/^\/affiliate\/dashboard\/([^/]+)$/)
  if (dashboardMatch) return <AffiliateDashboardScreen affiliateId={dashboardMatch[1]} />

  if (pathname === '/beli') return <BeliLandingScreen />
  if (pathname === '/beli/selesai') return <PaymentSuccessScreen />

  if (pathname === '/admin/penghantaran') return <AdminShippingScreen />
  if (pathname === '/admin/pengurusan-admin') return <AdminManagementScreen />

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicRoot />
  </StrictMode>,
)
