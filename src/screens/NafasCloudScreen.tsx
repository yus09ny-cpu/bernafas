import { NafasCloudIcon } from '@/components/nav/icons'
import PlaceholderScreen from '@/components/PlaceholderScreen'

export default function NafasCloudScreen() {
  return (
    <PlaceholderScreen
      icon={<NafasCloudIcon size={30} active />}
      title="NafasCloud"
      description="Kongsi pencapaian dan bandingkan sesi dengan komuniti Bernafas."
    />
  )
}
