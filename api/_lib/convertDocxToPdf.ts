import CloudConvert from 'cloudconvert'

// Replaces the earlier LibreOffice-headless-in-a-Vercel-Function approach —
// investigated and rejected: a full LibreOffice install is ~600MB-1GB
// uncompressed, well past Vercel's standard 250MB Function bundle limit
// (confirmed against Vercel's own docs, 2026-08-19), and wrapping it in a
// Docker/OCI container Function doesn't escape that limit either (container
// Functions "inherit standard function limits for size, memory, and
// duration" per Vercel's own guidance). CloudConvert was chosen over
// self-hosting a Gotenberg container specifically because this service has
// no persistent-server infra anywhere today (bernafas AND madrasah-iam are
// both 100% Vercel serverless) — adding one just for this would be new
// operational surface for a solo-maintained project. Conversion volume is
// low by design: affiliate_book_generations caches one PDF per
// (affiliate, book_version), so this only ever runs once per new affiliate,
// comfortably inside CloudConvert's free tier (10 conversions/day) unless
// affiliate signups spike hard.
//
// Uses import/base64 (not import/upload) — the whole rendered docx fits in
// one job-creation call, no separate upload POST/multipart dance needed.
// cloudconvert.jobs.wait() polls/subscribes internally (the package's one
// dependency, socket.io-client, is what backs this) rather than this file
// hand-rolling a poll loop.
const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY

const SOURCE_FILENAME = 'INI_JANTUNGMU.docx'

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  if (!CLOUDCONVERT_API_KEY) {
    throw new Error('CLOUDCONVERT_API_KEY tidak ditetapkan.')
  }

  const cloudConvert = new CloudConvert(CLOUDCONVERT_API_KEY)

  let job = await cloudConvert.jobs.create({
    tasks: {
      'import-docx': {
        operation: 'import/base64',
        file: docxBuffer.toString('base64'),
        filename: SOURCE_FILENAME,
      },
      'convert-to-pdf': {
        operation: 'convert',
        input: 'import-docx',
        output_format: 'pdf',
        engine: 'office',
      },
      'export-pdf': {
        operation: 'export/url',
        input: 'convert-to-pdf',
      },
    },
  })

  job = await cloudConvert.jobs.wait(job.id)

  if (job.status === 'error') {
    const failedTask = job.tasks.find(t => t.status === 'error')
    throw new Error(`CloudConvert job gagal: ${failedTask?.message ?? 'sebab tidak diketahui'}`)
  }

  const [file] = cloudConvert.jobs.getExportUrls(job)
  if (!file?.url) {
    throw new Error('CloudConvert tidak pulangkan URL fail PDF.')
  }

  const response = await fetch(file.url)
  if (!response.ok) {
    throw new Error(`Gagal muat turun PDF dari CloudConvert: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
