import { GuidesIcon } from '@/components/nav/icons'
import PlaceholderScreen from '@/components/PlaceholderScreen'

export default function GuidesScreen() {
  return (
    <PlaceholderScreen
      icon={<GuidesIcon size={30} active />}
      title="Panduan"
      description="Teknik pernafasan berpandu dan penjelasan ringkas tentang skor HRV."
    />
  )
}
