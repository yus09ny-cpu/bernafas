import { useState } from 'react'
import HistoryList from '@/screens/review/HistoryList'
import HistoryDetail from '@/screens/review/HistoryDetail'

// List vs. detail toggle for Review's History sub-tab — selectedId is the
// only state that decides which view renders, so "back" is just clearing
// it rather than a real navigation stack (there's only ever one level).
export default function HistoryTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return selectedId ? (
    <HistoryDetail sessionId={selectedId} onBack={() => setSelectedId(null)} />
  ) : (
    <HistoryList onSelect={setSelectedId} />
  )
}
