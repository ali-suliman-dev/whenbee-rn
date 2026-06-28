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
import { FounderReserveCard } from './FounderReserveCard';
import { PlanPicker } from './PlanPicker';
import { openManageSubscriptions } from './manageSubscription';
import { copyFor, isTrigger, type Trigger } from './paywallCopy';
import { ValueStack } from './ValueStack';
import { TrialTimeline } from './TrialTimeline';
import { TopProof } from './TopProof';

// ──────────────────────────────────────────────────────────────────────────────
// Paywall — Whenbee's single Pro gate. The adaptive top section (eyebrow/title/sub
// + proof visual + which bundle row leads) is keyed off whichever gate the user
// tapped, so the pitch is always relevant — never a generic calendar pitch for a
// goals gate. The five-row bundle stack covers all of Pro.
//
// Prices are ALWAYS read from the live offering's `priceString` (never hardcoded).
// While offerings load we show a calm spinner-free placeholder; if they fail or
// arrive empty we show a graceful "try again later" instead of crashing.
//
// Triggers: the screen reads a `trigger` param and fires `paywall_view {trigger}`
// once on mount. `plan_selected` fires on each plan tap; trial/purchase/restore
// outcomes come from the entitlement result.
// ──────────────────────────────────────────────────────────────────────────────

/** Earned-readiness framing for the lead heading. */
type Readiness = 'pre' | 'honest';

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

  const copy = copyFor(resolvedTrigger, readiness);
  const showTimeline = selected ? selected.duration !== 'lifetime' : true;

  const heading: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const proofText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, fontStyle: 'italic' };
  const fineText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' };
  const linkText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };
  const errorText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.danger, textAlign: 'center' };
  const eyebrowText: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText, letterSpacing: 0.8 };

  const proofRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const linkRow: ViewStyle = { flexDirection: 'row', justifyContent: 'center', gap: t.space[6] };
  const eyebrowChip: ViewStyle = {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: t.space[1.5],
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2.5], paddingVertical: t.space[1],
  };
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
          <View style={eyebrowChip}>
            <Ionicons name="sparkles-outline" size={t.iconSize.sm} color={t.colors.accent} />
            <Text style={eyebrowText}>{copy.eyebrow}</Text>
          </View>
          <Text style={heading}>{copy.title}</Text>
          <Text style={sub}>{copy.sub}</Text>
        </View>

        {/* Show-don't-tell proof, chosen by the gate. */}
        <TopProof kind={copy.proof} />

        {/* The whole bundle — five grouped rows, lead row floated to top. */}
        <ValueStack lead={copy.lead} />

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

            {showTimeline ? <TrialTimeline /> : null}

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

            {/* Calibration is free forever — the real no-card trial. */}
            <View style={freeStrip}>
              <Text style={freeStripText}>
                <Text style={freeStripStrong}>Calibration stays free, always.</Text> No card, no renewal — that is your real trial. Pro just adds the payoff.
              </Text>
            </View>

            {/* One honest line. No fabricated numbers. */}
            <View style={proofRow}>
              <Ionicons name="heart-outline" size={t.iconSize.sm} color={t.colors.accent} />
              <Text style={proofText}>Built by people who are late to everything. It is the tool we needed first.</Text>
            </View>
          </>
        )}

        {isExpoGo ? <Text style={fineText}>Running in Expo Go — purchases are simulated.</Text> : null}
      </ScrollView>
    </Screen>
  );
}
