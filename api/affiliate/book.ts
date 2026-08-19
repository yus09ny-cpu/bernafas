import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { supabaseAdmin } from '../_lib/supabaseAdmin'
import { renderAffiliateDocx } from '../_lib/docxTemplate'
import { convertDocxToPdf } from '../_lib/convertDocxToPdf'

// Bumping this invalidates every affiliate's cached PDF (spec item 4/
// affiliate_book_generations' own doc comment: "regenerate bila buku
// update") — the next /api/affiliate/book request per affiliate
// regenerates instead of reusing affiliate_book_generations' cached row.
// Change this string whenever buku/INI_JANTUNGMU_template.docx is edited.
const BOOK_VERSION = 'v1'

const TEMPLATE_PATH = path.join(process.cwd(), 'buku', 'INI_JANTUNGMU_template.docx')
const STORAGE_BUCKET = 'affiliate-books'

// Signed URL lifetime for the download link this returns — long enough for
// a real download to complete, short enough that a leaked link doesn't
// stay valid indefinitely (the storage bucket itself is private, per
// migration setup — see the createBucket call this session ran).
const SIGNED_URL_TTL_SECONDS = 60 * 10

// GET /api/affiliate/book?username=<affiliate username> — spec item 4.
// Cache-first: checks affiliate_book_generations for a (username,
// BOOK_VERSION) row before doing any docx/PDF work at all. Only on a
// miss/stale version does it render the token, convert via CloudConvert,
// and upload — see convertDocxToPdf.ts's own header for why CloudConvert
// over an in-Function LibreOffice binary.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const username = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : null
  if (!username) {
    res.status(400).json({ error: 'Parameter username diperlukan.' })
    return
  }

  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from('affiliates')
    .select('username')
    .eq('username', username)
    .maybeSingle()

  if (affiliateError) {
    console.error('[api/affiliate/book] affiliate select failed:', affiliateError.message)
    res.status(500).json({ error: 'Gagal semak affiliate.' })
    return
  }
  if (!affiliate) {
    res.status(404).json({ error: 'Affiliate tidak dijumpai.' })
    return
  }

  // Cache check — the whole point of affiliate_book_generations.
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from('affiliate_book_generations')
    .select('pdf_storage_path')
    .eq('affiliate_username', username)
    .eq('book_version', BOOK_VERSION)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cacheError) {
    console.error('[api/affiliate/book] cache select failed:', cacheError.message)
    res.status(500).json({ error: 'Gagal semak cache.' })
    return
  }

  let storagePath = cached?.pdf_storage_path ?? null

  if (!storagePath) {
    let templateBuffer: Buffer
    try {
      templateBuffer = await readFile(TEMPLATE_PATH)
    } catch (err) {
      console.error('[api/affiliate/book] template read failed:', err)
      res.status(500).json({ error: 'Templat buku tidak dijumpai di server.' })
      return
    }

    const renderedDocx = await renderAffiliateDocx(templateBuffer, username)

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await convertDocxToPdf(renderedDocx)
    } catch (err) {
      console.error('[api/affiliate/book] docx->pdf conversion failed:', err)
      res.status(502).json({ error: 'Gagal jana PDF. Cuba sekali lagi sebentar lagi.' })
      return
    }

    storagePath = `${username}/${BOOK_VERSION}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      console.error('[api/affiliate/book] storage upload failed:', uploadError.message)
      res.status(500).json({ error: 'Gagal muat naik PDF.' })
      return
    }

    const { error: insertError } = await supabaseAdmin.from('affiliate_book_generations').insert({
      affiliate_username: username,
      book_version: BOOK_VERSION,
      pdf_storage_path: storagePath,
    })
    if (insertError) {
      // Non-fatal — the PDF itself is already uploaded and downloadable;
      // this just means the next request regenerates instead of hitting
      // cache. Logged, not surfaced as a user-facing error.
      console.error('[api/affiliate/book] generation record insert failed:', insertError.message)
    }
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (signError || !signed) {
    console.error('[api/affiliate/book] signed URL creation failed:', signError?.message)
    res.status(500).json({ error: 'Gagal jana pautan muat turun.' })
    return
  }

  res.status(200).json({ url: signed.signedUrl, cached: Boolean(cached?.pdf_storage_path) })
}
