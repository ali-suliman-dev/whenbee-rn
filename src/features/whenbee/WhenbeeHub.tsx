import { useCallback } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { Honeycomb } from '@/src/components/honeycomb/Honeycomb';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { CATEGORY_NAMES } from '@/src/engine';
import { RayBurst } from '@/src/components/bee/RayBurst';
import { useWhenbeeHub } from './useWhenbeeHub';
import { WhenbeeAvatar } from './WhenbeeAvatar';
import { TierTrailHub } from './TierTrailHub';
import { ReclaimHeroCard } from './ReclaimHeroCard';
import { BlindSpotCard } from './BlindSpotCard';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeHub — the companion surface, where honey AND Reclaim grow. Same card
// vocabulary and restraint as Today: one focal card (the Reclaim hero), amber as
// the Reclaim/identity accent, indigo kept scarce (the drill-down chevrons + the
// blind-spot arrow), never red.
//
// Vertical order, hero → detail:
//   1. Avatar + hub honeycomb        (the felt "this is mine, and it's ripening")
//   2. Tier trail                    (the journey, Raw → Honest)
//   3. Reclaim hero card             (the payoff — the focal element)
//   4. Blind-spot nudge              (kind next step, when present)
//   5. Per-category rows             (drill into each category's Tune screen)
//   6. "Make my whole day honest"    (the Pro CTA → paywall)
//
// Reclaim is an async read that does NOT push on every deposit, so we re-pull it
// on focus (useFocusEffect) — the bank is fresh every time the tab is entered.
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

  // Reclaim doesn't push on deposit — re-pull the async totals on tab focus.
  const { refresh } = vm;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function openCategory(id: string) {
    router.push({ pathname: '/category/[category]', params: { category: id } });
  }

  function openPaywall() {
    router.push('/(modals)/paywall');
  }

  const heroZone: ViewStyle = { alignItems: 'center', gap: t.space[4] };
  const avatarBurst: ViewStyle = {
    width: t.burst.stage,
    height: t.burst.stage,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const sectionLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={{ gap: t.space[5] }}>
      {/* 1 — Companion + honeycomb (soft sunburst pattern behind the avatar) */}
      <View style={heroZone}>
        <View style={avatarBurst}>
          <RayBurst size={t.burst.stage} />
          <WhenbeeAvatar tier={vm.tier} />
        </View>
        {vm.cells.length > 0 ? <Honeycomb size="hub" cells={vm.cells} /> : null}
      </View>

      {/* 2 — Tier trail */}
      <TierTrailHub tier={vm.tier} />

      {/* 3 — Reclaim hero (the focal payoff) */}
      <ReclaimHeroCard
        lifetimeMin={vm.reclaimLifetimeMin}
        honestLogCount={vm.honestLogCount}
        biggestArea={vm.biggestArea}
      />

      {/* 4 — Blind-spot nudge (kind, conditional) */}
      {vm.blindSpot ? <BlindSpotCard blindSpot={vm.blindSpot} /> : null}

      {/* 5 — Per-category drill-down */}
      {categories.length > 0 ? (
        <View style={{ gap: t.space[3] }}>
          <Text style={sectionLabel}>IN THE BACKGROUND</Text>
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              name={categoryLabel(cat.id)}
              multiplier={stats[cat.id]?.mEffective}
              onPress={() => openCategory(cat.id)}
            />
          ))}
        </View>
      ) : (
        <AppText variant="caption">Track a few tasks and your categories will appear here.</AppText>
      )}

      {/* 6 — Pro CTA */}
      <AppButton label="Make my whole day honest" variant="amber" fullWidth onPress={openPaywall} />
    </View>
  );
}

function CategoryRow({
  name,
  multiplier,
  onPress,
}: {
  name: string;
  multiplier: number | undefined;
  onPress: () => void;
}) {
  const t = useTheme();
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: 56,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const nameText: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const multText: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.md,
    color: t.colors.primary,
    fontVariant: ['tabular-nums'],
  };

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name} insights`} style={row}>
      <Text style={nameText}>{name}</Text>
      {multiplier !== undefined ? <Text style={multText}>{multiplier.toFixed(1)}×</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={t.colors.inkSoft} />
    </Pressable>
  );
}
