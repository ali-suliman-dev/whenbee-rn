import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { BeeBurst } from '@/src/components/bee/BeeBurst';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { analytics } from '@/src/services/analytics';
import type { Package } from '@/src/services/purchases';
import { useEntitlement } from './useEntitlement';
import { useOfferings } from './useOfferings';
import { useFounderReserve } from './useFounderReserve';
import { BeforeAfterHero } from './BeforeAfterHero';
import { FounderReserveCard } from './FounderReserveCard';
import { PlanPicker } from './PlanPicker';
import { openManageSubscriptions } from './manageSubscription';

// ──────────────────────────────────────────────────────────────────────────────
// Paywall — Whenbee's single Pro gate. The same flat-card vocabulary as Today:
// one focal illustration, the honest-day before/after as the lead reason to pay,
// four benefit lines, one modest social-proof line, the store-priced plan picker,
// one CTA, then restore / manage / small print.
//
// Prices are ALWAYS read from the live offering's `priceString` (never hardcoded).
// While offerings load we show a calm spinner-free placeholder; if they fail or
// arrive empty we show a graceful "try again later" instead of crashing.
//
// Triggers: the screen reads a `trigger` param and fires `paywall_view {trigger}`
// once on mount. `plan_selected` fires on each plan tap; trial/purchase/restore
// outcomes come from the entitlement result.
// ──────────────────────────────────────────────────────────────────────────────

type Trigger = 'make_day_honest' | 'settings_upgrade' | 'steals_your_time' | 'pro_reveal' | 'pro_preview' | 'goals' | 'focus_window' | 'hyperfocus_guard' | 'pdf_export';

/** Earned-readiness framing for the lead heading. */
type Readiness = 'pre' | 'honest';

/**
 * The earned ("post-honest") heading + subhead. Shown only once a user's numbers
 * have settled into honest — it names what they've already earned, rather than
 * pitching a problem they haven't solved yet.
 */
const HONEST_HEADING = 'Your numbers are real now.';
const HONEST_SUBHEAD =
  'You did the logging — Whenbee knows how your days actually run. Let it carry those real numbers into your calendar.';

const BENEFITS = [
  { icon: 'time-outline', text: 'Every calendar event padded with your real buffers, automatically.' },
  { icon: 'trending-up', text: 'See how much your day can actually hold — before you overbook it.' },
  { icon: 'refresh-outline', text: 'Recurring tasks remember their honest length, so you set them once.' },
  { icon: 'arrow-forward', text: 'Send your honest plan or time profile to a coach or partner in one tap. The image is made on your phone and never leaves it without you.' },
] as const;

function isTrigger(v: unknown): v is Trigger {
  return (
    v === 'make_day_honest' ||
    v === 'settings_upgrade' ||
    v === 'steals_your_time' ||
    v === 'pro_reveal' ||
    v === 'pro_preview' ||
    v === 'goals' ||
    v === 'focus_window' ||
    v === 'hyperfocus_guard' ||
    v === 'pdf_export'
  );
}

/** Map a package to its analytics plan name. */
function planName(pkg: Package): 'yearly' | 'lifetime' | 'monthly' {
  if (pkg.duration === 'yearly') return 'yearly';
  if (pkg.duration === 'lifetime') return 'lifetime';
  return 'monthly';
}

/**
 * Find the founder package in the live offering, identified by "founder" in its
 * RevenueCat package id or its store product id (e.g. `wb_pro_founder`). The
 * offering author wires this package; if it isn't present the caller simply does
 * not render the reservation card (graceful absence — never a hardcoded price).
 */
function findFounderPackage(packages: readonly Package[]): Package | null {
  const hit = packages.find(
    (p) => p.id.toLowerCase().includes('founder') || p.productId.toLowerCase().includes('founder'),
  );
  return hit ?? null;
}

export function Paywall({ trigger, readiness = 'pre' }: { trigger?: string; readiness?: Readiness }) {
  const t = useTheme();
  const purchase = useEntitlement((s) => s.purchase);
  const restore = useEntitlement((s) => s.restore);
  const { status, offering } = useOfferings();
  const { reserved, reserve } = useFounderReserve();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedTrigger: Trigger = isTrigger(trigger) ? trigger : 'make_day_honest';
  const isHonest = readiness === 'honest';

  // Fire paywall_view exactly once on mount, with the resolved trigger + readiness.
  useEffect(() => {
    analytics.capture('paywall_view', { trigger: resolvedTrigger, readiness });
    // Intentionally mount-only: a re-render must not re-fire the funnel event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the selection to the hero (yearly) once the offering lands.
  useEffect(() => {
    if (status !== 'ready' || !offering || selectedId) return;
    const hero = offering.packages.find((p) => p.duration === 'yearly') ?? offering.packages[0];
    if (hero) setSelectedId(hero.id);
  }, [status, offering, selectedId]);

  const selected = offering?.packages.find((p) => p.id === selectedId) ?? null;

  // Founder-price reservation: offered ONLY before the user's numbers are honest,
  // and only when the live offering actually carries a founder package. Suppressed
  // once honest (they should just buy at this price) and absent if not configured.
  const founderPkg = offering ? findFounderPackage(offering.packages) : null;
  const showFounderReserve = !isHonest && founderPkg != null;

  function handleSelect(pkg: Package) {
    setSelectedId(pkg.id);
    analytics.capture('plan_selected', { plan: planName(pkg) });
  }

  async function handleBuy() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    const plan = planName(selected);
    const isSub = selected.duration !== 'lifetime';
    try {
      await purchase(selected);
      if (isSub) analytics.capture('trial_started', { plan, price: 0, result: 'success' });
      analytics.capture('purchase', { plan, price: 0, result: 'success' });
      router.back();
    } catch {
      analytics.capture('purchase', { plan, price: 0, result: 'error' });
      setError("That didn't go through. No charge was made — give it another try.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await restore();
      const isPro = useEntitlement.getState().isPro;
      analytics.capture('restore_purchases', { result: isPro ? 'success' : 'none' });
      if (isPro) router.back();
      else setError('No earlier purchase found on this Apple ID.');
    } catch {
      analytics.capture('restore_purchases', { result: 'error' });
      setError("Couldn't reach the store. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function handleManage() {
    analytics.capture('manage_subscription', { source: 'paywall' });
    openManageSubscriptions();
  }

  // CTA label tracks the selection: trial verb for subs, one-time verb for lifetime.
  const ctaLabel =
    selected?.duration === 'lifetime'
      ? `Unlock Pro — ${selected.priceString}`
      : 'Try 7 days free';

  const heading: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const benefitText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const proofText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, fontStyle: 'italic' };
  const fineText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' };
  const linkText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };
  const errorText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.danger, textAlign: 'center' };

  const benefitRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const proofRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const linkRow: ViewStyle = { flexDirection: 'row', justifyContent: 'center', gap: t.space[6] };
  // The free-tier reassurance (prototype): the real no-card, no-renewal trial.
  const freeStrip: ViewStyle = {
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[3],
  };
  const freeStripText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };
  const freeStripStrong: TextStyle = { fontFamily: 'Jakarta-Bold' };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[3], paddingBottom: t.space[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Grabber above the sunburst so the rotating rays never cover it. */}
        <View style={{ zIndex: 2 }}>
          <SheetGrabber />
        </View>

        <View style={{ alignItems: 'center' }}>
          <BeeBurst variant="upgrade" />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={heading}>
            {isHonest ? HONEST_HEADING : 'Stop planning a day that was never going to fit.'}
          </Text>
          <Text style={sub}>
            {isHonest
              ? HONEST_SUBHEAD
              : 'Whenbee already knows your real numbers. Let it quietly rebuild your calendar to match.'}
          </Text>
        </View>

        {/* The single clearest reason to pay. */}
        <BeforeAfterHero />

        {/* Benefits — calendar honesty headline first. */}
        <View style={{ gap: t.space[3] }}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={benefitRow}>
              <Ionicons name={b.icon} size={t.iconSize.md} color={t.colors.primary} />
              <Text style={benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Social proof — one modest, honest line. No fabricated numbers. */}
        <View style={proofRow}>
          <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.accent} />
          <Text style={proofText}>Built by people who are late to everything. It is the tool we needed first.</Text>
        </View>

        {/* Plans — store-priced, three states. */}
        {status === 'loading' ? (
          <Text style={[sub, { textAlign: 'center' }]}>Loading plans…</Text>
        ) : status === 'unavailable' || !offering ? (
          <Text style={[sub, { textAlign: 'center' }]}>
            Plans are not available right now. Check your connection and reopen this screen.
          </Text>
        ) : (
          <>
            {showFounderReserve && founderPkg ? (
              <FounderReserveCard
                priceString={founderPkg.priceString}
                reserved={reserved}
                onReserve={reserve}
              />
            ) : null}

            <PlanPicker offering={offering} selectedId={selectedId} onSelect={handleSelect} />

            {error ? <Text style={errorText}>{error}</Text> : null}

            <AppButton
              label={busy ? 'One moment…' : ctaLabel}
              variant="amber"
              fullWidth
              disabled={busy || !selected}
              onPress={handleBuy}
            />

            <Text style={fineText}>
              No charge today. We will remind you before the trial ends. Cancel anytime. On-device and private.
            </Text>

            <View style={linkRow}>
              <Pressable
                onPress={handleRestore}
                accessibilityRole="button"
                accessibilityLabel="Restore purchases"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
              >
                <Text style={linkText}>Restore</Text>
              </Pressable>
              <Pressable
                onPress={handleManage}
                accessibilityRole="button"
                accessibilityLabel="Manage your subscription"
              >
                <Text style={linkText}>Manage subscription</Text>
              </Pressable>
            </View>

            {/* The free tier is the real no-card, no-renewal trial — say so plainly. */}
            <View style={freeStrip}>
              <Text style={freeStripText}>
                Not ready to decide? <Text style={freeStripStrong}>The free tier stays fully useful.</Text> No
                card, no renewal. That is your real trial.
              </Text>
            </View>
          </>
        )}

        {isExpoGo ? (
          <Text style={fineText}>Running in Expo Go — purchases are simulated.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
