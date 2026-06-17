import { useCallback } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { CATEGORY_NAMES } from '@/src/engine';
import { useWhenbeeHub } from './useWhenbeeHub';
import { WhenbeeAvatar } from './WhenbeeAvatar';
import { HoneyRing } from './HoneyRing';
import { RingBadge } from './RingBadge';
import { AreaRow } from './AreaRow';
import { ReclaimHeroCard } from './ReclaimHeroCard';
import { DiscoveriesPreviewCard } from './DiscoveriesPreviewCard';
import { BlindSpotCard } from './BlindSpotCard';
import { LifeDriftCard } from './LifeDriftCard';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeHub — ring hero + labeled zones (Reclaimed, Discoveries, Your Areas).
//
// Vertical order:
//   1. ScreenHeader (title + context-aware subtitle)
//   2. HERO: HoneyRing wrapping WhenbeeAvatar + RingBadge below
//   3. RECLAIMED zone: label + explain + ReclaimHeroCard
//   4. DISCOVERIES zone: label + explain + DiscoveriesPreviewCard (when any exist)
//   5. Conditional gentle cards: LifeDriftCard, BlindSpotCard
//   6. YOUR AREAS zone: label + explain + one AreaRow per category
//   7. CTA: empty → "Log your first task"; populated → "Make my whole day honest"
//
// No RayBurst, no TierTrailHub, no Honeycomb grid.
// No glow on the bee (glow={false} passthrough).
// ──────────────────────────────────────────────────────────────────────────────

function categoryLabel(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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

  const heroZone: ViewStyle = { alignItems: 'center', gap: t.space[3] };
  const zoneWrap: ViewStyle = { gap: t.space[2] };
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

  return (
    <View style={{ gap: t.space[5] }}>
      {/* Header — title only; the ring + zones carry the context. */}
      <ScreenHeader title="Whenbee" />

      {/* HERO — honey ring + bee (no glow) + ring badge */}
      <View style={heroZone}>
        <HoneyRing sharpness={vm.leadSharpness} sealed={vm.tier === 'Honest'}>
          <WhenbeeAvatar
            stage={vm.companion.stage}
            seed={vm.companion.seed}
            driftHealth={vm.companion.driftHealth}
            name={vm.companion.name ?? undefined}
            glow={false}
          />
        </HoneyRing>
        <RingBadge sharpness={vm.leadSharpness} />
      </View>

      {/* RECLAIMED zone */}
      <View style={zoneWrap}>
        <Text style={zoneLabel}>Reclaimed</Text>
        <Text style={zoneExplain}>time your honest numbers won back</Text>
        <ReclaimHeroCard
          lifetimeMin={vm.reclaimLifetimeMin}
          honestLogCount={vm.honestLogCount}
          biggestArea={vm.biggestArea}
        />
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
        <View style={zoneWrap}>
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
      ) : (
        <AppButton
          label="Make my whole day honest"
          variant="amber"
          fullWidth
          onPress={openDayHonest}
        />
      )}
    </View>
  );
}
