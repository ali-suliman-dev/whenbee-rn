import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation('paywall');
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

  // Default the selection to the hero (yearly) — derived synchronously so the CTA
  // is live the same render the offering lands. An effect-based default left a
  // window where the offering was ready and the CTA rendered, but `selected` was
  // still null → a dead/disabled tap (and a flaky purchase test).
  const heroId = useMemo(() => {
    if (!offering) return null;
    const hero = offering.packages.find((p) => p.duration === 'yearly') ?? offering.packages[0];
    return hero?.id ?? null;
  }, [offering]);

  const selected = offering?.packages.find((p) => p.id === (selectedId ?? heroId)) ?? null;

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
      setError(tr('plans.purchaseError'));
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
      else setError(tr('plans.restoreNone'));
    } catch {
      analytics.capture('restore_purchases', { result: 'error' });
      setError(tr('plans.restoreError'));
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
      ? tr('plans.ctaUnlock', { price: selected.priceString })
      : tr('plans.ctaTrial');

  const copy = copyFor(tr, resolvedTrigger, readiness);
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
          <Text style={[sub, { textAlign: 'center' }]}>{tr('plans.loading')}</Text>
        ) : status === 'unavailable' || !offering ? (
          <Text style={[sub, { textAlign: 'center' }]}>{tr('plans.unavailable')}</Text>
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
              label={busy ? tr('plans.ctaBusy') : ctaLabel}
              variant="amber"
              fullWidth
              disabled={busy || !selected}
              onPress={handleBuy}
            />

            <Text style={fineText}>{tr('plans.finePrint')}</Text>

            <View style={linkRow}>
              <Pressable
                onPress={handleRestore}
                accessibilityRole="button"
                accessibilityLabel={tr('plans.restoreLinkA11y')}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
              >
                <Text style={linkText}>{tr('plans.restoreLink')}</Text>
              </Pressable>
              <Pressable
                onPress={handleManage}
                accessibilityRole="button"
                accessibilityLabel={tr('plans.manageLinkA11y')}
              >
                <Text style={linkText}>{tr('plans.manageLink')}</Text>
              </Pressable>
            </View>

            {/* Calibration is free forever — the real no-card trial. */}
            <View style={freeStrip}>
              <Text style={freeStripText}>
                <Text style={freeStripStrong}>{tr('plans.freeStripBold')}</Text> {tr('plans.freeStripRest')}
              </Text>
            </View>

            {/* One honest line. No fabricated numbers. */}
            <View style={proofRow}>
              <Ionicons name="heart-outline" size={t.iconSize.sm} color={t.colors.accent} />
              <Text style={proofText}>{tr('plans.trustLine')}</Text>
            </View>
          </>
        )}

        {isExpoGo ? <Text style={fineText}>{tr('plans.expoGoNotice')}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
