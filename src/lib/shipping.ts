import { supabase } from '@/lib/supabase'

export interface MyShippingOrder {
  orderId: string
  productType: string
  amount: number
  paidAt: string
  shippingSubmitted: boolean
  shippingStatus: 'belum_hantar' | 'dihantar' | null
  trackingNumber: string | null
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchMyShippingOrders(): Promise<{ orders: MyShippingOrder[]; error: string | null }> {
  const response = await fetch('/api/shipping', { headers: await authHeader() })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { orders: [], error: data.error ?? 'Gagal muatkan pesanan.' }
  return { orders: data.orders ?? [], error: null }
}

export interface ShippingAddressInput {
  orderId: string
  recipientName: string
  phone: string
  address: string
  postcode: string
  state: string
}

export async function saveShippingAddress(input: ShippingAddressInput): Promise<{ success: boolean; error: string | null }> {
  const response = await fetch('/api/shipping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(input),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { success: false, error: data.error ?? 'Gagal simpan alamat.' }
  return { success: true, error: null }
}
