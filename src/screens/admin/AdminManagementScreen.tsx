import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import AuthScreen from '@/screens/AuthScreen'

type AdminRole = 'master' | 'super' | 'admin'

interface AdminProfile {
  id: string
  email: string
  admin_role: AdminRole
  created_at: string
}

const ROLE_LABEL: Record<AdminRole, string> = {
  master: 'Master Admin',
  super: 'Super Admin',
  admin: 'Admin',
}

const ROLE_OPTIONS: AdminRole[] = ['master', 'super', 'admin']

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function AdminRow({ admin, onChanged }: { admin: AdminProfile; onChanged: () => void }) {
  const [role, setRole] = useState<AdminRole>(admin.admin_role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setRoleOnServer = async (nextRole: AdminRole | null) => {
    if (saving) return
    setSaving(true)
    setError(null)
    const response = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ email: admin.email, role: nextRole }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(data.error ?? 'Gagal kemas kini.')
      return
    }
    onChanged()
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[var(--color-text)]">{admin.email}</span>
        <select
          value={role}
          disabled={saving}
          onChange={e => {
            const nextRole = e.target.value as AdminRole
            setRole(nextRole)
            setRoleOnServer(nextRole)
          }}
          className="rounded-lg border border-[var(--color-card-border)] bg-white/80 px-2 py-1 text-xs outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
        >
          {ROLE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{ROLE_LABEL[opt]}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between">
        {error && <p className="text-xs text-[var(--color-warm)]">{error}</p>}
        <button
          type="button"
          onClick={() => setRoleOnServer(null)}
          disabled={saving}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-warm)] disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Buang admin
        </button>
      </div>
    </div>
  )
}

function AddAdminForm({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('admin')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    const trimmed = email.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    const response = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ email: trimmed, role }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(data.error ?? 'Gagal tambah admin.')
      return
    }
    setEmail('')
    onAdded()
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 text-sm">
      <div className="flex gap-2">
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@contoh.com"
          className="flex-1 rounded-lg border border-[var(--color-card-border)] bg-white/80 px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value as AdminRole)}
          className="rounded-lg border border-[var(--color-card-border)] bg-white/80 px-2 py-2 text-xs outline-none focus:border-[var(--color-primary)]"
        >
          {ROLE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{ROLE_LABEL[opt]}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-[var(--color-warm)]">{error}</p>}
      <button
        type="button"
        onClick={handleAdd}
        disabled={saving || !email.trim()}
        className="flex items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
        Tambah Admin
      </button>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Pengguna mesti sudah log masuk ke app sekurang-kurangnya sekali (magic link) sebelum boleh dijadikan admin.
      </p>
    </div>
  )
}

// /admin/pengurusan-admin — master-admin-only screen for granting/changing/
// revoking OTHER admins' roles. Reached the same way as
// AdminShippingScreen.tsx (outside App.tsx's auth+app-access gate, own
// useAuth check, own role check via api/admin/admins.ts's
// hasAdminRole(user, 'master') server-side guard — see
// supabase/migrations/0007_admin_roles.sql).
export default function AdminManagementScreen() {
  const { status } = useAuth()
  const [admins, setAdmins] = useState<AdminProfile[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    authHeader().then(headers => {
      fetch('/api/admin/admins', { headers }).then(async response => {
        const data = await response.json().catch(() => ({}))
        if (response.status === 403) {
          setForbidden(true)
          return
        }
        if (!response.ok) {
          setError(data.error ?? 'Gagal muatkan senarai admin.')
          return
        }
        setAdmins(data.admins ?? [])
      })
    })
  }

  useEffect(() => {
    if (status === 'signed-in') load()
  }, [status])

  if (status === 'loading') return null
  if (status !== 'signed-in') return <AuthScreen />
  if (forbidden) {
    return (
      <div className="flex h-dvh w-full items-center justify-center px-8 text-center">
        <p className="text-sm text-[var(--color-warm)]">Tiada akses.</p>
      </div>
    )
  }

  return (
    <div className="h-dvh w-full overflow-y-auto bg-[var(--color-bg)] px-5 py-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-top))' }}>
      <h1 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--color-primary-dark)]">
        <ShieldCheck size={20} /> Urus Admin
      </h1>

      {error && <p className="mb-3 text-sm text-[var(--color-warm)]">{error}</p>}
      {admins === null && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {admins && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Admin Sedia Ada ({admins.length})</h2>
            {admins.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Tiada admin.</p>}
            {admins.map(a => <AdminRow key={a.id} admin={a} onChanged={load} />)}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Tambah Admin Baharu</h2>
            <AddAdminForm onAdded={load} />
          </section>
        </div>
      )}
    </div>
  )
}
