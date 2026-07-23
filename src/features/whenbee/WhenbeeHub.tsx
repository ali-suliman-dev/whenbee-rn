import { useCallback, useEffect } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { RipeningProCard } from '@/src/components/ripening-pro/RipeningProCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
import { analytics } from '@/src/services/analytics';
import { TIERS, logsToNextTier, tierBandProgress, FEATURE_MIN_LOGS } from '@/src/engine';
import type { ProFeatureId } from '@/src/engine';
import { waitLabelFor } from '@/src/components/ripening-pro/copy';
import { useWhenbeeHub } from './useWhenbeeHub';
import { WhenbeeAvatar } from './WhenbeeAvatar';
import { HoneyRing } from './HoneyRing';
import { RingBadge } from './RingBadge';
import { AreaRow } from './AreaRow';
import { DiscoveriesPreviewCard } from './DiscoveriesPreviewCard';
import { categoryLabel } from './discoveryDisplay';
import { BlindSpotCard } from './BlindSpotCard';
import { LifeDriftCard } from './LifeDriftCard';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeHub — ring hero + labeled zones (Discoveries, Your Areas).
//
// Vertical order:
//   1. ScreenHeader (title + context-aware subtitle)
//   2. HERO: HoneyRing wrapping WhenbeeAvatar + RingBadge below
//   3. DISCOVERIES zone: label + explain + DiscoveriesPreviewCard (when any exist)
//   4. Conditional gentle cards: LifeDriftCard, BlindSpotCard
//   5. YOUR AREAS zone: label + explain + one AreaRow per category
//   6. CTA: empty → "Log your first task"; populated → "Make my whole day honest"
//
// No RayBurst, no TierTrailHub, no Honeycomb grid.
// Bee: no glow halo (glow={false}); a soft-edge neutral coin backs it off the ring
// interior (backdrop="soft" — fades at the rim, no edge line), and it runs the calm
// micro-life (soft wing flutter, slow blink, glance whose body-lean conveys direction).
// ──────────────────────────────────────────────────────────────────────────────


export function WhenbeeHub() {
  const t = useTheme();
  const vm = useWhenbeeHub();
  const categories = useCategoriesStore((s) => s.categories);
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const isPro = useEntitlement((s) => s.isPro);

  // Reclaim doesn't push on deposit — re-pull the async totals on tab focus.
  const { refresh } = vm;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Fire a shown impression once per pitchUnlocked state change.
  // Keyed on pitchUnlocked so it fires at most once per transition.
  const { pitchUnlocked } = vm.proReadiness;
  useEffect(() => {
    if (isPro) return;
    analytics.capture(pitchUnlocked ? 'pro_reveal_shown' : 'ripening_pro_shown', {
      surface: 'whenbee_hub',
    });
  }, [pitchUnlocked, isPro]);

  const isEmpty = vm.honestLogCount === 0;

  // Sharpness flows LIVE into the ring — HoneyRing itself gates animate-vs-snap on
  // focus (live growth animates; growth earned off-screen is already-full on
  // arrival, no replay). Seal + stage stay deferred: those are once-per-arrival
  // celebrations you want to actually witness when you land.
  const shownSharpness = vm.leadSharpness;
  const shownSealed = useFocusedValue(vm.tier === 'Honest');
  const shownStage = useFocusedValue(vm.companion.stage);

  function openCategory(id: string) {
    router.push({ pathname: '/category/[category]', params: { category: id } });
  }

  function openDayHonest() {
    if (isPro) {
      router.push('/(modals)/honest-day');
      return;
    }
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'make_day_honest' } });
  }

  function logFirst() {
    router.push('/(modals)/add-task');
  }

  const heroZone: ViewStyle = { alignItems: 'center', gap: t.space[3] };
  const zoneWrap: ViewStyle = { gap: t.space[2] };
  // The Areas zone gets extra air above its label so it reads as a fresh section,
  // not crowding the conditional card (BlindSpot/Discoveries) above it.
  const areasZone: ViewStyle = { ...zoneWrap, marginTop: t.space[2] };
  const zoneLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const zoneExplain: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const ctaSub: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'center',
    marginTop: t.space[2],
  };

  // ── Ripening Pro card derivations (non-Pro path only) ────────────────────
  // Mirror the same tier-index pattern as HoneycombStripPlaceholder.
  const tierIdx = TIERS.indexOf(vm.tier);
  const nextTierName =
    tierIdx >= 0 && tierIdx < TIERS.length - 1 ? (TIERS[tierIdx + 1] ?? null) : null;

  // Four key features shown in the card; waitLabels are honest, no-guilt.
  // 'confidence-band' is always first and always the next-up feature while this
  // card is in the ripening state (its readiness IS pitchUnlocked, which is
  // false whenever this branch renders) — its tally/pip progress is the real
  // in-tier-band fraction, never a fabricated number. The other, log-gated
  // features get a real "N logs to go" (or calendar-register) wait label.
  const { perFeatureReady } = vm.proReadiness;
  const bandProgress = tierBandProgress(vm.leadSharpness);
  const confidenceBandProgress = bandProgress.total > 0 ? bandProgress.done / bandProgress.total : undefined;
  const remainingLogsFor = (id: Exclude<ProFeatureId, 'confidence-band'>) =>
    Math.max(0, FEATURE_MIN_LOGS[id] - vm.honestLogCount);
  const ripeningFeatures = [
    { id: 'confidence-band' as const, ready: perFeatureReady['confidence-band'], progress: confidenceBandProgress },
    {
      id: 'steals-your-time' as const,
      ready: perFeatureReady['steals-your-time'],
      waitLabel: waitLabelFor('steals-your-time', remainingLogsFor('steals-your-time')),
    },
    {
      id: 'day-capacity' as const,
      ready: perFeatureReady['day-capacity'],
      waitLabel: waitLabelFor('day-capacity', remainingLogsFor('day-capacity')),
    },
    {
      id: 'honest-week' as const,
      ready: perFeatureReady['honest-week'],
      waitLabel: waitLabelFor('honest-week', remainingLogsFor('honest-week')),
    },
  ];

  return (
    <View style={{ gap: t.space[5] }}>
      {/* Header — title only; the ring + zones carry the context. */}
      <ScreenHeader title="Whenbee" />

      {/* HERO — honey ring + bee (no glow) + ring badge */}
      <View style={heroZone}>
        <HoneyRing sharpness={shownSharpness} sealed={shownSealed}>
          <WhenbeeAvatar
            stage={shownStage}
            seed={vm.companion.seed}
            driftHealth={vm.companion.driftHealth}
            name={vm.companion.name ?? undefined}
            glow={false}
            size={t.companion.ringBee}
            backdrop="soft"
            animated
          />
        </HoneyRing>
        <RingBadge sharpness={shownSharpness} />
      </View>

      {/* DISCOVERIES zone — shown once any aha card has been banked */}
      {vm.discoveryCount > 0 ? (
        <View style={zoneWrap}>
          <Text style={zoneLabel}>Discoveries</Text>
          <Text style={zoneExplain}>surprising truths about how long things take</Text>
          <DiscoveriesPreviewCard
            discoveries={vm.discoveries}
            discoveryCount={vm.discoveryCount}
          />
        </View>
      ) : null}

      {/* Conditional gentle cards (no-guilt, never punitive) */}
      {vm.showDriftRecheck ? (
        <LifeDriftCard
          companionName={vm.companion.name}
          blindSpot={vm.blindSpot}
          onDismiss={vm.dismissDriftRecheck}
        />
      ) : null}
      {vm.blindSpot ? <BlindSpotCard blindSpot={vm.blindSpot} /> : null}

      {/* YOUR AREAS zone */}
      {categories.length > 0 ? (
        <View style={areasZone}>
          <Text style={zoneLabel}>Your areas</Text>
          <Text style={zoneExplain}>fill = how honest your guesses are · tap to tune</Text>
          <View style={{ gap: t.space[2] }}>
            {categories.map((cat) => (
              <AreaRow
                key={cat.id}
                name={categoryLabel(cat.id)}
                multiplier={stats[cat.id]?.mEffective}
                sharpness={stats[cat.id]?.sharpness ?? 0}
                onPress={() => openCategory(cat.id)}
              />
            ))}
          </View>
        </View>
      ) : (
        <AppText variant="caption">Track a few tasks and your areas will appear here.</AppText>
      )}

      {/* CTA — first-log prompt or day-honest shortcut */}
      {isEmpty ? (
        <View>
          <AppButton label="Log your first task" variant="amber" fullWidth onPress={logFirst} />
          <Text style={ctaSub}>Honest-day planning unlocks once your honey sets.</Text>
        </View>
      ) : isPro ? (
        <AppButton
          label="Make my whole day honest"
          variant="amber"
          fullWidth
          onPress={openDayHonest}
        />
      ) : (
        <RipeningProCard
          pitchUnlocked={vm.proReadiness.pitchUnlocked}
          nextTierName={nextTierName}
          logsToNext={logsToNextTier(vm.leadSharpness)}
          features={ripeningFeatures}
          onSeePro={() => {
            // Same callback both states share — the event name distinguishes the
            // ripening honey chip (a soft preview tap) from the reveal-state CTA.
            analytics.capture(
              vm.proReadiness.pitchUnlocked ? 'pro_reveal_tap' : 'ripening_get_pro_tapped',
              { surface: 'whenbee_hub' },
            );
            router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pro_reveal' } });
          }}
          onPreview={() => {
            analytics.capture('pro_preview_tap', { surface: 'whenbee_hub' });
            router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pro_preview' } });
          }}
        />
      )}
    </View>
  );
}
