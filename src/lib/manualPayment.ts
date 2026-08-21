import { supabase } from '@/lib/supabase'

// "Wise (Antarabangsa)" manual payment path — backs BeliLandingScreen.tsx's
// Wise flow and AdminManualPaymentScreen.tsx's review screen. Server side:
// api/checkout/manual-payment.ts.

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // readAsDataURL prefixes "data:image/png;base64," — the API only
      // wants the base64 payload itself, content-type is sent separately
      // (file.type) so it's never re-derived from this string.
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function submitManualPaymentProof(input: {
  productType: string
  email: string
  file: File
}): Promise<{ orderId: string | null; error: string | null }> {
  const imageBase64 = await fileToBase64(input.file)
  const response = await fetch('/api/checkout/manual-payment?action=submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productType: input.productType,
      email: input.email,
      imageBase64,
      imageContentType: input.file.type,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { orderId: null, error: data.error ?? 'Gagal hantar bukti bayaran.' }
  return { orderId: data.orderId ?? null, error: null }
}

export interface ManualPaymentProof {
  id: string
  order_id: string
  proof_image_path: string
  submitted_email: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  imageUrl: string | null
  orders: { product_type: string; amount: number; email: string | null } | null
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchManualPaymentProofs(): Promise<{ proofs: ManualPaymentProof[] | null; forbidden: boolean; error: string | null }> {
  const response = await fetch('/api/checkout/manual-payment?action=list', { headers: await authHeader() })
  if (response.status === 403) return { proofs: null, forbidden: true, error: null }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { proofs: null, forbidden: false, error: data.error ?? 'Gagal muatkan senarai.' }
  return { proofs: data.proofs ?? [], forbidden: false, error: null }
}

async function reviewManualPaymentProof(action: 'approve' | 'reject', proofId: string): Promise<{ success: boolean; error: string | null }> {
  const response = await fetch(`/api/checkout/manual-payment?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ proofId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { success: false, error: data.error ?? 'Gagal proses.' }
  return { success: true, error: null }
}

export const approveManualPaymentProof = (proofId: string) => reviewManualPaymentProof('approve', proofId)
export const rejectManualPaymentProof = (proofId: string) => reviewManualPaymentProof('reject', proofId)
