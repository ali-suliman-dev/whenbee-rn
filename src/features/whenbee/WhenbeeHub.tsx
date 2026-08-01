import { useCallback, useEffect } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useFocusEffect } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { RipeningProCard } from '@/src/components/ripening-pro/RipeningProCard';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { analytics } from '@/src/services/analytics';
import { TIERS, logsToNextTier, tierBandProgress, FEATURE_MIN_LOGS } from '@/src/engine';
import type { ProFeatureId } from '@/src/engine';
import { waitLabelFor } from '@/src/components/ripening-pro/copy';
import { useWhenbeeHub } from './useWhenbeeHub';
import { UnlockLadder } from './UnlockLadder';
import { AreaRow } from './AreaRow';
import { DiscoveriesPreviewCard } from './DiscoveriesPreviewCard';
import { categoryLabel } from './discoveryDisplay';
import { BlindSpotCard } from './BlindSpotCard';
import { LifeDriftCard } from './LifeDriftCard';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeHub — "Progress" tab. Compact header + labeled zones (Discoveries,
// the unlock ladder, Your Areas).
//
// Vertical order:
//   1. Compact header: screen title left, a small BeeMascot mark right (the
//      bee is demoted from full-screen hero to a mark — Task 6,
//      plain-calibration-copy plan; it keeps every other appearance —
//      onboarding, archetype crest, reward burst, empty states)
//   2. DISCOVERIES zone: label + explain + DiscoveriesPreviewCard (when any exist)
//   3. UNLOCK LADDER: <UnlockLadder/> — the six-stage capability list, the
//      thing that actually motivates logging, now visible instead of buried
//      behind the ring hero
//   4. Conditional gentle cards: LifeDriftCard, BlindSpotCard
//   5. YOUR AREAS zone: label + explain + one AreaRow per category
//   6. CTA: empty → "Log your first task"; populated → "Make my whole day honest"
//
// No RayBurst, no TierTrailHub, no Honeycomb grid, no ring hero.
// ──────────────────────────────────────────────────────────────────────────────


export function WhenbeeHub() {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { t: tc } = useTranslation('common');
  const { t: patternsT } = useTranslation('patterns');
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
      waitLabel: waitLabelFor(patternsT, 'steals-your-time', remainingLogsFor('steals-your-time')),
    },
    {
      id: 'day-capacity' as const,
      ready: perFeatureReady['day-capacity'],
      waitLabel: waitLabelFor(patternsT, 'day-capacity', remainingLogsFor('day-capacity')),
    },
    {
      id: 'honest-week' as const,
      ready: perFeatureReady['honest-week'],
      waitLabel: waitLabelFor(patternsT, 'honest-week', remainingLogsFor('honest-week')),
    },
  ];

  return (
    <View style={{ gap: t.space[5] }}>
      {/* Compact header — title left, a small bee MARK right (not a hero). */}
      <ScreenHeader
        title={tc('screenTitle.whenbee')}
        right={
          <BeeMascot
            size={t.companion.headerMark}
            // The mark reflects the companion's growth, same stage→variant
            // mapping the Today header ring uses. Without it the bee is frozen
            // at stage-1 art forever.
            variant={`stage-${vm.companion.stage}` as BeeVariant}
            seed={vm.companion.seed}
            glow={false}
          />
        }
      />

      {/* DISCOVERIES zone — shown once any aha card has been banked */}
      {vm.discoveryCount > 0 ? (
        <View style={zoneWrap}>
          <Text style={zoneLabel}>{tr('hub.discoveries.label')}</Text>
          <Text style={zoneExplain}>{tr('hub.discoveries.explain')}</Text>
          <DiscoveriesPreviewCard
            discoveries={vm.discoveries}
            discoveryCount={vm.discoveryCount}
          />
        </View>
      ) : null}

      {/* UNLOCK LADDER — the six-stage capability list; what your logs buy you */}
      <UnlockLadder keeper={vm.companion.keeper} />

      {/* Conditional gentle cards (no-guilt, never punitive) */}
      {vm.showDriftRecheck ? (
        <LifeDriftCard blindSpot={vm.blindSpot} onDismiss={vm.dismissDriftRecheck} />
      ) : null}
      {vm.blindSpot ? <BlindSpotCard blindSpot={vm.blindSpot} /> : null}

      {/* YOUR AREAS zone */}
      {categories.length > 0 ? (
        <View style={areasZone}>
          <Text style={zoneLabel}>{tr('hub.areas.label')}</Text>
          <Text style={zoneExplain}>{tr('hub.areas.explain')}</Text>
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
        <AppText variant="caption">{tr('hub.areas.empty')}</AppText>
      )}

      {/* CTA — first-log prompt or day-honest shortcut */}
      {isEmpty ? (
        <View>
          <AppButton label={tr('hub.cta.logFirst')} variant="amber" fullWidth onPress={logFirst} />
          <Text style={ctaSub}>{tr('hub.cta.logFirstSub')}</Text>
        </View>
      ) : isPro ? (
        <AppButton
          label={tr('hub.cta.dayHonest')}
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
