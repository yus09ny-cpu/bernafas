import { useState, type ReactElement } from 'react'
import BottomNav, { type Tab } from '@/components/nav/BottomNav'
import AccountMenu from '@/components/nav/AccountMenu'
import SessionScreen from '@/screens/SessionScreen'
import ReviewScreen from '@/screens/ReviewScreen'
import JournalScreen from '@/screens/JournalScreen'
import GuidesScreen from '@/screens/GuidesScreen'
import NafasCloudScreen from '@/screens/NafasCloudScreen'
import AuthScreen from '@/screens/AuthScreen'
import SubscriptionRequiredScreen from '@/screens/SubscriptionRequiredScreen'
import { useAuth } from '@/hooks/useAuth'
import { useAppAccess } from '@/hooks/useAppAccess'

const SCREENS: Record<Tab, () => ReactElement> = {
  session: SessionScreen,
  review: ReviewScreen,
  journal: JournalScreen,
  guides: GuidesScreen,
  nafascloud: NafasCloudScreen,
}

// App shell — five-tab bottom nav plus whichever screen is active, plus a
// fixed top-right AccountMenu (sign-out) rendered here rather than inside
// any one screen, so it's reachable from every tab instead of buried in
// one of them.
// SessionScreen (and the BLE/HRV session inside it) unmounts when the user
// switches away from the Sesi tab; nothing here persists it across tabs,
// same as ConnectScreen's device connection was never persisted across a
// session boundary before this shell existed.
//
// Gated behind auth AND app-access (wired 2026-08-20 — no existing users to
// grandfather, confirmed with product owner, so no transition/allowlist
// logic needed here, just a direct gate). Two layers, checked in order:
// signed-in (useAuth) first, then subscription/lifetime-purchase access
// (useAppAccess) — a session with no active RM19.90/bulan subscription and
// no paid pakej_lifetime order sees SubscriptionRequiredScreen instead of
// the tab shell, for every tab (not just Sesi), same reasoning as the auth
// gate above it. AccountMenu renders on the blocked screen too (fixed,
// outside the `main` swap below) so a blocked user can still sign out or
// see their subscription state, not just stare at a locked screen with no
// way out.
// 'loading' (either auth OR access-check in flight) renders nothing rather
// than flashing AuthScreen/SubscriptionRequiredScreen then immediately
// replacing it for already-entitled returning users.
export default function App() {
  const { session, status } = useAuth()
  const [tab, setTab] = useState<Tab>('session')
  const access = useAppAccess(status === 'signed-in' ? session : null)

  if (status === 'loading') return null
  if (status !== 'signed-in') return <AuthScreen />
  if (access.status === 'loading') return null
  if (access.status === 'blocked') {
    return (
      <div className="relative h-dvh w-full overflow-hidden">
        <SubscriptionRequiredScreen recheck={access.recheck} />
        <AccountMenu />
      </div>
    )
  }

  const ActiveScreen = SCREENS[tab]

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <main className="h-full w-full overflow-hidden">
        <ActiveScreen />
      </main>
      <AccountMenu />
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
