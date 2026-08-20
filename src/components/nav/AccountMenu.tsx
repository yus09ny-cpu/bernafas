import { useEffect, useState } from 'react'
import { DoorOpen, LogOut, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuth } from '@/hooks/useAuth'
import { fetchSubscriptionStatus, startAppSubscriptionCheckout, type SubscriptionStatus } from '@/lib/subscription'

// Persistent account affordance, rendered once in App.tsx (not per-screen)
// so it's reachable from every tab, not just one — the sign-out action has
// nowhere else to live since BottomNav's five slots are all taken by
// content tabs. Fixed top-LEFT (not top-right, deliberately) + a door/exit
// glyph (not Settings2's sliders) — Skrin 1's SmoothnessSetting already
// occupies top-right with that exact sliders icon, and this is a
// meaningful, one-way action (sign out) sitting right next to a harmless
// preference toggle. Same corner+same icon would make the two easy to
// mis-tap for each other; different icon AND different corner removes
// that ambiguity twice over rather than relying on just one.
export default function AccountMenu() {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Subscription status display + subscribe action — reads the same
  // profiles.subscription_tier/subscription_expiry App.tsx's gate
  // (useAppAccess, wired 2026-08-20) checks. This popover is reachable even
  // when SubscriptionRequiredScreen is blocking the rest of the app (App.tsx
  // renders AccountMenu on both branches) — a second subscribe entry point
  // alongside that screen's own CTA, not a replacement for it.
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !session?.user.id) return
    fetchSubscriptionStatus(session.user.id).then(({ data }) => setSubscription(data))
  }, [open, session?.user.id])

  const handleSubscribe = async () => {
    if (subscribing) return
    setSubscribing(true)
    setSubscribeError(null)
    const { paymentUrl, error } = await startAppSubscriptionCheckout()
    if (error || !paymentUrl) {
      setSubscribeError(error ?? 'Gagal mula langganan.')
      setSubscribing(false)
      return
    }
    window.location.href = paymentUrl
  }

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    // No manual navigation back to AuthScreen needed — App.tsx's
    // useAuth().status flips to 'signed-out' via onAuthStateChange the
    // instant this resolves, which is already its render gate.
    setOpen(false)
    setSigningOut(false)
  }

  return (
    <div
      className="fixed left-4 z-50"
      style={{ top: 'calc(1rem + var(--safe-top))' }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Akaun"
          className="grid size-10 place-items-center rounded-full bg-card/70 text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur transition-colors hover:text-foreground"
        >
          <DoorOpen className="size-5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56">
          <div className="space-y-3">
            {session?.user.email && (
              <p className="truncate text-xs text-muted-foreground" title={session.user.email}>
                {session.user.email}
              </p>
            )}

            <div className="space-y-1.5 border-y border-border py-3 text-xs">
              <p className="font-medium text-foreground">
                {subscription?.tier === 'active' ? 'Langganan aktif' : 'Belum melanggan'}
              </p>
              {subscription?.tier === 'active' && subscription.expiresAt && (
                <p className="text-muted-foreground">
                  Tamat: {new Date(subscription.expiresAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              {subscription?.tier !== 'active' && (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-primary)]/10 px-2 py-2 font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20 disabled:opacity-50"
                >
                  {subscribing ? <Loader2 size={14} className="animate-spin" /> : 'Langgan RM19.90/bulan'}
                </button>
              )}
              {subscribeError && <p className="text-[var(--color-warm)]">{subscribeError}</p>}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--color-warm)]/10 hover:text-[var(--color-warm)] disabled:opacity-50"
            >
              <LogOut className="size-4" />
              {signingOut ? 'Log keluar...' : 'Log keluar'}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
