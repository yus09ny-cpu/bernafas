import { JournalIcon } from '@/components/nav/icons'
import PlaceholderScreen from '@/components/PlaceholderScreen'

export default function JournalScreen() {
  return (
    <PlaceholderScreen
      icon={<JournalIcon size={30} active />}
      title="Jurnal"
      description="Catat refleksi ringkas selepas setiap sesi pernafasan."
    />
  )
}
