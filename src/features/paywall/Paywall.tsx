import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { ProCoin } from '@/src/components/ProCoin';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { analytics } from '@/src/services/analytics';
import type { Package } from '@/src/services/purchases';
import { classifyPurchaseError } from '@/src/services/purchaseErrors';
import { useEntitlement } from './useEntitlement';
import { useOfferings } from './useOfferings';
import { useFounderReserve } from './useFounderReserve';
import { FounderReserveCard } from './FounderReserveCard';
import { PlanPicker } from './PlanPicker';
import { copyFor, isTrigger, type Trigger } from './paywallCopy';
import { TrialTimeline } from './TrialTimeline';
import { DayWithPro } from './DayWithPro';
import { FeatureGroups } from './FeatureGroups';
import { PaywallFooter } from './PaywallFooter';
import { InlineNotice } from './InlineNotice';
import { usePaywallVariant } from './usePaywallVariant';

// ──────────────────────────────────────────────────────────────────────────────
// Paywall — Whenbee's single Pro gate, V3 "editorial" skeleton (2026-07 redesign):
// header → feature section (variant) → founder card → plans → trial timeline →
// inline notice → CTA → quiet footer. The paywall's one job is making the trial
// decision easy and fear-free — the Day-5 reminder promise is explicit, and the
// success screen (pro-welcome) keeps it.
//
// Prices are ALWAYS read from the live offering's `priceString` (never hardcoded).
// Purchase errors are classified: user-cancel shows NOTHING; recoverable errors
// keep the user here, selection preserved, CTA becomes the retry.
// Spec: docs/product/specs/2026-07-19-paywall-redesign.md
// ──────────────────────────────────────────────────────────────────────────────

/** Earned-readiness framing for the lead heading. */
type Readiness = 'pre' | 'honest';

interface Notice {
  tone: 'danger' | 'neutral';
  title?: string;
  message: string;
  retryable: boolean;
}

/** If the store neither resolves nor rejects, never leave the CTA spinning. */
const PURCHASE_WATCHDOG_MS = 30_000;

const GENERIC_PURCHASE_NOTICE: Notice = {
  tone: 'danger',
  title: "That didn't go through.",
  message: "You weren't charged. Check your connection and try once more.",
  retryable: true,
};

const DECLINED_PURCHASE_NOTICE: Notice = {
  tone: 'danger',
  title: 'Your payment method was declined.',
  message: "You weren't charged. Check it in your store settings, then try again.",
  retryable: true,
};

/** Map a package to its analytics plan name. */
function planName(pkg: Package): 'yearly' | 'lifetime' | 'monthly' {
  if (pkg.duration === 'yearly') return 'yearly';
  if (pkg.duration === 'lifetime') return 'lifetime';
  return 'monthly';
}

/**
 * Find the founder package in the live offering, identified by "founder" in its
 * RevenueCat package id or its store product id (e.g. `wb_pro_founder`). If it
 * isn't present the reservation card simply doesn't render.
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
  const { variant } = usePaywallVariant();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const attemptRef = useRef(0);

  const resolvedTrigger: Trigger = isTrigger(trigger) ? trigger : 'make_day_honest';
  const isHonest = readiness === 'honest';

  // Fire paywall_view exactly once on mount, with the resolved trigger + readiness.
  useEffect(() => {
    analytics.capture('paywall_view', {
      trigger: resolvedTrigger,
      readiness,
      feature_variant: variant,
    });
    // Intentionally mount-only: a re-render must not re-fire the funnel event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the selection to the hero (yearly) — derived synchronously so the CTA
  // is live the same render the offering lands.
  const heroId = useMemo(() => {
    if (!offering) return null;
    const hero = offering.packages.find((p) => p.duration === 'yearly') ?? offering.packages[0];
    return hero?.id ?? null;
  }, [offering]);

  const selected = offering?.packages.find((p) => p.id === (selectedId ?? heroId)) ?? null;

  // Founder-price reservation: offered ONLY before the user's numbers are honest,
  // and only when the live offering actually carries a founder package.
  const founderPkg = offering ? findFounderPackage(offering.packages) : null;
  const showFounderReserve = !isHonest && founderPkg != null;

  function handleSelect(pkg: Package) {
    setSelectedId(pkg.id);
    analytics.capture('plan_selected', { plan: planName(pkg) });
  }

  function routeToWelcome(plan: string) {
    router.replace({
      pathname: '/pro-welcome',
      params: { plan, purchasedAt: new Date().toISOString() },
    });
  }

  async function handleBuy() {
    if (!selected || busy) return;
    setBusy(true);
    setNotice(null);
    const attempt = ++attemptRef.current;
    const plan = planName(selected);
    const isSub = selected.duration !== 'lifetime';
    const watchdog = setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      setBusy(false);
      setNotice(GENERIC_PURCHASE_NOTICE);
    }, PURCHASE_WATCHDOG_MS);
    try {
      await purchase(selected);
      if (isSub) analytics.capture('trial_started', { plan, price: 0, result: 'success' });
      analytics.capture('purchase', { plan, price: 0, result: 'success' });
      routeToWelcome(plan);
    } catch (e) {
      const kind = classifyPurchaseError(e);
      analytics.capture('purchase', {
        plan,
        price: 0,
        result: kind === 'cancelled' ? 'cancelled' : 'error',
      });
      // A deliberate cancel is not an error — show nothing at all.
      if (kind === 'declined') setNotice(DECLINED_PURCHASE_NOTICE);
      else if (kind === 'other') setNotice(GENERIC_PURCHASE_NOTICE);
    } finally {
      clearTimeout(watchdog);
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await restore();
      const isPro = useEntitlement.getState().isPro;
      analytics.capture('restore_purchases', { result: isPro ? 'success' : 'none' });
      if (isPro) routeToWelcome('restore');
      else
        setNotice({
          tone: 'neutral',
          message:
            'No earlier purchase on this account. If you subscribed with another one, switch and restore there.',
          retryable: false,
        });
    } catch {
      analytics.capture('restore_purchases', { result: 'error' });
      setNotice({
        tone: 'danger',
        title: "Couldn't reach the store.",
        message: 'Try again in a moment.',
        retryable: false,
      });
    } finally {
      setBusy(false);
    }
  }

  // CTA label tracks the selection and the error state.
  const isLifetime = selected?.duration === 'lifetime';
  const ctaLabel = busy
    ? 'One moment…'
    : notice?.retryable
      ? 'Try again'
      : isLifetime && selected
        ? `Get Pro forever · ${selected.priceString}`
        : 'Try 7 days free';

  const copy = copyFor(resolvedTrigger, readiness);
  const showTimeline = selected ? selected.duration !== 'lifetime' : true;

  const heading: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const fineText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'center',
  };

  return (
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[3], paddingBottom: t.space[8] }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />

        <View style={{ gap: t.space[2] }}>
          <ProCoin
            size="md"
            label={copy.eyebrow}
            icon={<Ionicons name="ribbon" size={t.iconSize.sm} color={t.colors.onAmber} />}
          />
          <Text style={heading}>{copy.title}</Text>
          <Text style={sub}>{copy.sub}</Text>
        </View>

        {/* Everything in Pro — the founder-picked variant, all 12 features. */}
        {variant === 'groups' ? <FeatureGroups /> : <DayWithPro />}

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

            <PlanPicker
              offering={offering}
              selectedId={selectedId ?? heroId}
              onSelect={handleSelect}
            />

            {showTimeline ? <TrialTimeline /> : null}

            {notice ? (
              <InlineNotice tone={notice.tone} title={notice.title} message={notice.message} />
            ) : null}

            <AppButton
              label={ctaLabel}
              variant="amber"
              fullWidth
              disabled={busy || !selected}
              onPress={handleBuy}
            />

            <PaywallFooter
              isLifetime={isLifetime === true}
              restoreDisabled={busy}
              onRestore={handleRestore}
            />
          </>
        )}

        {isExpoGo ? (
          <Text style={fineText}>Running in Expo Go — purchases are simulated.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
