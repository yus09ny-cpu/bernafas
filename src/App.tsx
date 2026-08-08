import { useState, type ReactElement } from 'react'
import BottomNav, { type Tab } from '@/components/nav/BottomNav'
import SessionScreen from '@/screens/SessionScreen'
import ReviewScreen from '@/screens/ReviewScreen'
import JournalScreen from '@/screens/JournalScreen'
import GuidesScreen from '@/screens/GuidesScreen'
import NafasCloudScreen from '@/screens/NafasCloudScreen'

const SCREENS: Record<Tab, () => ReactElement> = {
  session: SessionScreen,
  review: ReviewScreen,
  journal: JournalScreen,
  guides: GuidesScreen,
  nafascloud: NafasCloudScreen,
}

// App shell — five-tab bottom nav plus whichever screen is active.
// SessionScreen (and the BLE/HRV session inside it) unmounts when the user
// switches away from the Sesi tab; nothing here persists it across tabs,
// same as ConnectScreen's device connection was never persisted across a
// session boundary before this shell existed.
export default function App() {
  const [tab, setTab] = useState<Tab>('session')
  const ActiveScreen = SCREENS[tab]

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <main className="h-full w-full overflow-hidden">
        <ActiveScreen />
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
