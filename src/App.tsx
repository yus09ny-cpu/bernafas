import { useState, type ReactElement } from 'react'
import BottomNav, { type Tab } from '@/components/nav/BottomNav'
import AccountMenu from '@/components/nav/AccountMenu'
import SessionScreen from '@/screens/SessionScreen'
import ReviewScreen from '@/screens/ReviewScreen'
import JournalScreen from '@/screens/JournalScreen'
import GuidesScreen from '@/screens/GuidesScreen'
import NafasCloudScreen from '@/screens/NafasCloudScreen'
import AuthScreen from '@/screens/AuthScreen'
import { useAuth } from '@/hooks/useAuth'

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
// Gated behind auth: every tab (not just Sesi) needs a signed-in user, so
// the check sits here, above BottomNav/SCREENS, rather than inside
// SessionScreen alone. 'loading' (checking for an existing persisted
// session on first paint) renders nothing rather than flashing AuthScreen
// then immediately replacing it for already-logged-in returning users.
export default function App() {
  const { status } = useAuth()
  const [tab, setTab] = useState<Tab>('session')

  if (status === 'loading') return null
  if (status !== 'signed-in') return <AuthScreen />

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
