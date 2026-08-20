import { useAuth } from '@/hooks/useAuth'
import AuthScreen from '@/screens/AuthScreen'
import ShippingScreen from '@/screens/ShippingScreen'

// /beli/selesai — create-bill.ts's billReturnUrl, where ToyyibPay redirects
// the browser back after ANY product's checkout (buku/pakej_lifetime/
// sensor/app_subscription), successful or not (this route doesn't itself
// know which — it doesn't parse ToyyibPay's own status query params,
// deliberately: the async payment-callback webhook is the actual source of
// truth for whether an order is paid, same reasoning
// SubscriptionRequiredScreen's "semak semula" already leans on).
//
// Reuses ShippingScreen entirely rather than a separate order-lookup flow:
// it already fetches every 'sensor'/'pakej_lifetime' PAID order this user
// has and shows an address form for whichever ones still need one — that
// naturally covers "just paid for a sensor" without this screen needing to
// know which order the redirect was even for. A 'buku'/'app_subscription'
// buyer lands here too and simply sees no eligible orders to address,
// which is correct, not a bug.
export default function PaymentSuccessScreen() {
  const { status } = useAuth()

  if (status === 'loading') return null
  if (status !== 'signed-in') return <AuthScreen />

  return <ShippingScreen successBanner onClose={() => { window.location.href = '/' }} />
}
