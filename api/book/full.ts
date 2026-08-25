import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { convertDocxToPdf } from '../_lib/convertDocxToPdf.js'

// GET /api/book/full — the FULL 13-bab book, purchase-gated. Separate from
// api/affiliate/book.ts on purpose: that route serves the free 2-bab
// affiliate excerpt to ANYONE with a valid affiliate username, no purchase
// or login required (deliberately free/viral — do not merge these two
// routes or add a purchase check to affiliate/book.ts).
//
// Bump this whenever buku/INI_JANTUNGMU_A5_dengan_CTA_3_Jalan_1.docx
// changes — invalidates book_generations' cached row so the next request
// regenerates. Confirmed (by inspecting the docx directly) this file has
// no {{AFFILIATE_REF}} or any other per-buyer token, so — unlike the
// affiliate excerpt — there is exactly ONE PDF to ever generate per
// version, shared by every buyer (see book_generations' migration
// comment).
//
// v2 (2026-08-25): Bab 1-3 AI/Heart Brain theme + new "Kereta Elektrik"
// (EV) metaphor added. Confirmed the 3 hyperlinks (Jalan 2 bernafas.my/beli
// text + Jalan 3 https://bernafas.my/affiliate/daftar relationship + the
// www.bernafas.my colophon) are byte-identical to v1 — untouched by this
// content edit.
//
// v3 (2026-08-25): 3-Jalan CTA rebuilt at the correct location (end of
// book, right before LAMPIRAN — earlier misplaced mid-book in a prior
// edit). Jalan 2 (bernafas.my/beli) is now an actual hyperlink
// relationship, not just text. "6 Minggu" corrected to "40 Hari" in three
// places: Bab 13's opening sentence, the ISI KANDUNGAN entry, and the
// chapter heading itself — matching the "40 hari" terminology used
// throughout the rest of the book. Still no {{AFFILIATE_REF}} token.
const FULL_BOOK_VERSION = 'v3'

const TEMPLATE_PATH = path.join(process.cwd(), 'buku', 'INI_JANTUNGMU_A5_dengan_CTA_3_Jalan_1.docx')
const STORAGE_BUCKET = 'affiliate-books' // reused, not a new bucket — see this session's notes on why
const STORAGE_PATH = `full-book/${FULL_BOOK_VERSION}.pdf`
const SIGNED_URL_TTL_SECONDS = 60 * 10

// Products that grant full-book access. 'sensor' (hardware only) does NOT
// — confirmed against BeliLandingScreen.tsx's own pricing comment
// ("RM35 buku / RM499 pakej lifetime, from the book's own marketing
// copy") that 'buku' at RM35 IS the full digital book purchase, so it (and
// the bundle that includes it) are the only two that should unlock this.
// 'app_subscription' is a SEPARATE concern (app access, not book
// ownership) — deliberately excluded here too.
const BOOK_ACCESS_PRODUCT_TYPES = ['buku', 'pakej_lifetime']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' })
    return
  }

  // Purchase check — user_id (orders placed while signed in) OR a
  // case-insensitive email match (orders placed as a guest at /beli, with
  // the same email this account later signs in with). Neither alone is
  // enough to cover both checkout paths /beli actually supports.
  const { data: validOrder, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .in('product_type', BOOK_ACCESS_PRODUCT_TYPES)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (orderError) {
    console.error('[api/book/full] order lookup failed:', orderError.message)
    res.status(500).json({ error: 'Gagal semak pembelian.' })
    return
  }

  if (!validOrder) {
    res.status(403).json({
      error: 'Anda belum membeli buku penuh ini.',
      code: 'NOT_PURCHASED',
    })
    return
  }

  // Cache check — book_generations is global (one row ever, per version;
  // see FULL_BOOK_VERSION's own comment), not scoped to this buyer.
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from('book_generations')
    .select('pdf_storage_path')
    .eq('book_version', FULL_BOOK_VERSION)
    .maybeSingle()

  if (cacheError) {
    console.error('[api/book/full] cache select failed:', cacheError.message)
    res.status(500).json({ error: 'Gagal semak cache.' })
    return
  }

  let storagePath = cached?.pdf_storage_path ?? null

  if (!storagePath) {
    let templateBuffer: Buffer
    try {
      templateBuffer = await readFile(TEMPLATE_PATH)
    } catch (err) {
      console.error('[api/book/full] template read failed:', err)
      res.status(500).json({ error: 'Templat buku penuh tidak dijumpai di server.' })
      return
    }

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await convertDocxToPdf(templateBuffer)
    } catch (err) {
      console.error('[api/book/full] docx->pdf conversion failed:', err)
      const detail = err instanceof Error ? err.message : String(err)
      res.status(502).json({ error: `Gagal jana PDF: ${detail}` })
      return
    }

    storagePath = STORAGE_PATH
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('[api/book/full] storage upload failed:', uploadError.message)
      res.status(500).json({ error: 'Gagal muat naik PDF.' })
      return
    }

    const { error: insertError } = await supabaseAdmin.from('book_generations').insert({
      book_version: FULL_BOOK_VERSION,
      pdf_storage_path: storagePath,
    })
    if (insertError) {
      // Non-fatal — most likely a concurrent request already inserted the
      // same (unique) book_version a moment earlier; the PDF is already
      // uploaded and downloadable either way (upsert:true above made this
      // request's own upload a harmless no-op duplicate write in that
      // case). Same reasoning as affiliate/book.ts's own non-fatal insert.
      console.error('[api/book/full] generation record insert failed:', insertError.message)
    }
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed) {
    console.error('[api/book/full] signed URL creation failed:', signError?.message)
    res.status(500).json({ error: 'Gagal jana pautan muat turun.' })
    return
  }

  res.status(200).json({ url: signed.signedUrl, cached: Boolean(cached?.pdf_storage_path) })
}
