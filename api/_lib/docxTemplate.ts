import JSZip from 'jszip'

// The one token every affiliate's purchase-link hyperlink in
// buku/INI_JANTUNGMU_template.docx resolves through — see that file's
// word/_rels/document.xml.rels (3 retargeted hyperlink relationships: the
// 2 CTAs right after Bab 2, plus the one inside Lampiran C's "Hubungi Kami").
// A 4th "www.bernafas.my" hyperlink (the back-cover colophon) was
// deliberately left untouched — it's a copyright notice, not a purchase CTA.
export const AFFILIATE_TOKEN = '{{AFFILIATE_REF}}'

// Swaps every occurrence of AFFILIATE_TOKEN, across every XML/rels part of
// the docx zip, for this affiliate's actual username. Only 3 relationship
// Target attributes in word/_rels/document.xml.rels currently contain the
// token, but this sweeps every text-based zip entry rather than hardcoding
// that one path — harmless if the token never appears elsewhere, and
// correct automatically if a future book edit adds more tokenized links.
export async function renderAffiliateDocx(templateBuffer: Buffer, affiliateUsername: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer)

  const textEntries = Object.keys(zip.files).filter(name => name.endsWith('.xml') || name.endsWith('.rels'))
  for (const name of textEntries) {
    const file = zip.file(name)
    if (!file) continue
    const content = await file.async('string')
    if (content.includes(AFFILIATE_TOKEN)) {
      zip.file(name, content.split(AFFILIATE_TOKEN).join(affiliateUsername))
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
