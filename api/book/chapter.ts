import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole } from '../_lib/adminRole.js'

// GET /api/book/chapter?chapter_number=N — the in-app reader's content
// source, replacing api/book/full.ts's PDF download (kept, just no longer
// linked from the UI — a downloaded PDF can be redistributed freely once
// out, an in-app reader isn't). Rows come from public.book_chapters,
// populated once by scripts/parse-book-chapters.mjs (deleted after use).
//
// Two-tier gate:
//  - chapter_number 0-2 (Pengenalan, Bab 1, Bab 2): free preview — signed
//    in is enough, no purchase/access check at all.
//  - chapter_number 3+ (including 99, Lampiran): needs ONE of — a paid
//    'buku'/'pakej_lifetime' order (same check as api/book/full.ts), OR
//    an active app_subscription (same check as
//    api/app-access/status.ts), OR admin. Deliberately WIDER than
//    api/book/full.ts's own gate (which only checks the order) — a
//    subscriber who hasn't separately bought the book can still read it
//    in-app, per product owner's explicit call during this feature's
//    planning (the reader lives outside the app-access shell specifically
//    so book-only buyers can reach it, but the reverse — app-access
//    holders reading the book — was widened too, not just left as a gap).
const FREE_CHAPTER_MAX = 2
const BOOK_ACCESS_PRODUCT_TYPES = ['buku', 'pakej_lifetime']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const chapterNumberRaw = req.query.chapter_number
  const chapterNumber = typeof chapterNumberRaw === 'string' ? Number(chapterNumberRaw) : NaN
  if (!Number.isInteger(chapterNumber)) {
    res.status(400).json({ error: 'Parameter chapter_number diperlukan.' })
    return
  }

  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' })
    return
  }

  if (chapterNumber > FREE_CHAPTER_MAX) {
    const hasAccess = await checkBookAccess(user)
    if (!hasAccess) {
      res.status(403).json({
        error: 'Anda belum membeli buku penuh ini.',
        code: 'NOT_PURCHASED',
      })
      return
    }
  }

  const { data: chapter, error } = await supabaseAdmin
    .from('book_chapters')
    .select('chapter_number, title, content_html')
    .eq('chapter_number', chapterNumber)
    .maybeSingle()

  if (error) {
    console.error('[api/book/chapter] select failed:', error.message)
    res.status(500).json({ error: 'Gagal muatkan bab.' })
    return
  }
  if (!chapter) {
    res.status(404).json({ error: 'Bab tidak dijumpai.' })
    return
  }

  res.status(200).json({
    chapterNumber: chapter.chapter_number,
    title: chapter.title,
    contentHtml: chapter.content_html,
  })
}

async function checkBookAccess(user: { id: string; email: string }): Promise<boolean> {
  if (await hasAdminRole(user, 'admin')) return true

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier, subscription_expiry')
    .eq('id', user.id)
    .maybeSingle()

  const subscriptionActive =
    profile?.subscription_tier === 'active' &&
    (profile.subscription_expiry === null || new Date(profile.subscription_expiry) > new Date())
  if (subscriptionActive) return true

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id')
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .in('product_type', BOOK_ACCESS_PRODUCT_TYPES)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  return Boolean(order)
}
