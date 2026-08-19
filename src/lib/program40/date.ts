// Local (device-timezone) calendar-day string, "YYYY-MM-DD" — deliberately
// NOT `new Date().toISOString().slice(0, 10)` (that's UTC, which rolls over
// mid-afternoon/evening for Malaysia's UTC+8 and would misfile a late-night
// session onto the wrong calendar day for this user). Every program40
// read/write of session_date/start_date goes through this one function.
export function todayLocalISODate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// One calendar day earlier than a "YYYY-MM-DD" string, same format —
// used by computeStreak to check "is the streak still alive as of today."
export function addDaysISODate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + deltaDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
