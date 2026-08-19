import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'

const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/

// POST /api/affiliate/register — { name, email, username }.
// Uniqueness (spec item 2's "sahkan keunikan username sebelum simpan") is
// enforced by the DB's own `unique` constraints on affiliates.username/
// .email (see 0003_affiliate_program.sql) — insert-then-catch-23505 rather
// than a separate select-then-insert, which would leave a race window
// between two simultaneous registrations picking the same username.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { name, email, username } = (req.body ?? {}) as { name?: string; email?: string; username?: string }

  if (!name?.trim() || !email?.trim() || !username?.trim()) {
    res.status(400).json({ error: 'Nama, e-mel, dan username diperlukan.' })
    return
  }

  const normalizedUsername = username.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    res.status(400).json({ error: 'Username mesti 3-32 aksara, huruf kecil/nombor/tanda sempang(-) atau garis bawah(_) sahaja.' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    res.status(400).json({ error: 'E-mel tidak sah.' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .insert({ name: name.trim(), email: normalizedEmail, username: normalizedUsername, status: 'pending' })
    .select('id, username, status')
    .single()

  if (error) {
    // 23505 = unique_violation (Postgres) — username or email already taken.
    if (error.code === '23505') {
      const field = error.message.includes('email') ? 'E-mel' : 'Username'
      res.status(409).json({ error: `${field} ini sudah digunakan. Sila cuba yang lain.` })
      return
    }
    console.error('[api/affiliate/register] insert failed:', error.message)
    res.status(500).json({ error: 'Gagal mendaftar. Sila cuba sekali lagi.' })
    return
  }

  res.status(201).json({ id: data.id, username: data.username, status: data.status })
}
