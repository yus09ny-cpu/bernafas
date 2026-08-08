import { ReviewIcon } from '@/components/nav/icons'
import PlaceholderScreen from '@/components/PlaceholderScreen'

export default function ReviewScreen() {
  return (
    <PlaceholderScreen
      icon={<ReviewIcon size={30} active />}
      title="Semakan"
      description="Lihat trend HRV dan pencapaian anda merentasi semua sesi lepas."
    />
  )
}
