import { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useReward } from '@/src/features/reward/useReward';
import { RewardBee } from '@/src/features/reward/RewardBee';
import { HoneyBar } from '@/src/features/reward/HoneyBar';
import { ReclaimDeposit } from '@/src/features/reward/ReclaimDeposit';
import { ReasonChips } from '@/src/features/reward/ReasonChips';

// ──────────────────────────────────────────────────────────────────────────────
// Reward (Screen 4) — the dopamine payoff: logging IS the reward. One read path,
// top→bottom: feel it (bee + headline) → see the payoff (hero number + honey) →
// optionally tag a reason → one clear way out.
//
// Four priority zones in a ScrollView (level-up + reclaim + chips can exceed the
// sheet), CTA pinned to the bottom with the safe-area inset. THE one action is
// the indigo "See my Reclaim"; "Back to today" is a quiet text exit beneath it.
//
// Motion: a staggered top→bottom reveal (number rises in → honey fills → reclaim
// deposits → chips fade in last). Reduce-motion renders every final state still.
// ──────────────────────────────────────────────────────────────────────────────

export default function Reward() {
  const t = useTheme();
  const r = useReward();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // Hero number entrance — fade + a short rise. Declared before the no-reward
  // early return so hook order stays stable across both render paths.
  const heroOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const heroY = useSharedValue(reducedMotion ? 0 : t.space[3]);
  useEffect(() => {
    if (reducedMotion) {
      heroOpacity.set(1);
      heroY.set(0);
      return;
    }
    heroOpacity.set(withTiming(1, { duration: t.motion.base, easing: t.motion.easing.standard }));
    heroY.set(withTiming(0, { duration: t.motion.base, easing: t.motion.easing.standard }));
  }, [reducedMotion, heroOpacity, heroY, t.motion.base, t.motion.easing.standard]);
  const heroAnim = useAnimatedStyle(() => ({
    opacity: heroOpacity.get(),
    transform: [{ translateY: heroY.get() }],
  }));

  const headlineText: TextStyle = {
    ...(type.title as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const subText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  if (!r.hasReward) {
    const fallbackCenter: ViewStyle = {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.space[5],
    };
    return (
      <Screen>
        <View style={fallbackCenter}>
          <AppText style={headlineText}>Nothing to celebrate yet</AppText>
          <Text style={subText}>Log something and the honey will ripen here.</Text>
        </View>
        <View style={{ paddingBottom: insets.bottom + t.space[4] }}>
          <AppButton label="Back to today" variant="ghost" fullWidth onPress={r.onBackToToday} />
        </View>
      </Screen>
    );
  }

  // ── styles (token-driven; one spacing source per axis via the scroll gap) ──
  const scrollContent: ViewStyle = {
    flexGrow: 1,
    gap: t.space[4],
    paddingTop: t.space[2],
  };
  const tookEyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const capEyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.accent,
    textAlign: 'center',
    zIndex: 1, // above the sunburst so the rays never cover it
  };
  const ritualText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const honeyHeaderRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const honeyLabel: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const honeyPctText: TextStyle = {
    ...(type.multiplier as unknown as TextStyle),
    color: t.colors.amberText,
  };
  // The payoff card groups honey + multiplier + reclaim into one unit. Borders
  // are 0 globally, so the grouping reads off the white fill on the lavender bg.
  const payoffCard: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[2.5],
  };
  const heroBlock: ViewStyle = { alignItems: 'center', gap: t.space[1.5] };
  const ctaBlock: ViewStyle = {
    // Not pinned: rides the bottom of the scroll flow. marginTop pushes it down
    // when content is short, collapses when it overflows — so nothing hides
    // behind a fixed bar, but the action still sits low with a generous margin.
    marginTop: 'auto',
    gap: t.space[3],
    paddingTop: t.space[5],
    paddingBottom: insets.bottom + t.space[5],
  };
  const deltaChip: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1],
    marginTop: t.space[1],
  };
  const deltaChipText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const quietExit: ViewStyle = { alignSelf: 'center', paddingVertical: t.space[2] };
  const quietExitText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  // Neutral, glanceable delta — replaces the old gray "you guessed…" sentence.
  const deltaLabel =
    r.deltaDirection === 'over'
      ? `${r.deltaMin} min over your guess`
      : r.deltaDirection === 'under'
        ? `${r.deltaMin} min under your guess`
        : 'right on your guess';

  return (
    <Screen>
      <ScrollView contentContainerStyle={scrollContent} showsVerticalScrollIndicator={false}>
        {/* Zone 1 — emotional hit */}
        <View style={{ alignItems: 'center', gap: t.space[3] }}>
          {r.capEyebrow ? <Text style={capEyebrow}>{r.capEyebrow}</Text> : null}
          <RewardBee sealed={r.sealed} />
          <Text style={headlineText}>{r.headline}</Text>
        </View>

        {/* Zone 2 — hero stat (the single biggest element) */}
        <Animated.View style={[heroBlock, heroAnim]}>
          <Text style={tookEyebrow}>IT REALLY TOOK</Text>
          <HonestNumber size="xl" tone="ink" value={String(r.actualMin)} unit="min" />
          <View style={deltaChip}>
            <Text style={deltaChipText}>{deltaLabel}</Text>
          </View>
        </Animated.View>

        {/* Zone 3 — payoff card (honey + multiplier + reclaim as one unit) */}
        <View style={payoffCard}>
          <View style={honeyHeaderRow}>
            <Text style={honeyLabel}>HONEY</Text>
            <Text style={honeyPctText}>{r.honeyPct}%</Text>
          </View>
          <HoneyBar pct={r.honeyPct} />
          <Text style={subText}>
            {r.categoryLabel} runs at {r.multiplier.toFixed(1)}×
          </Text>

          {/* Tangible payoff: the minutes this log just banked. Only when >= 1m —
              never a "+0m". Staggered to land after the honey fill. */}
          {r.reclaimDeltaMin >= 1 ? (
            <>
              <ReclaimDeposit
                reclaimDeltaMin={r.reclaimDeltaMin}
                reclaimFrom={r.reclaimFrom}
                reclaimTo={r.reclaimTo}
                delayMs={t.motion.reveal}
              />
              <Text style={subText}>
                Your honest number was {r.reclaimDeltaMin} min closer.
              </Text>
            </>
          ) : null}
        </View>

        {/* Zone 4 — the one action: an optional "where'd the time go?" tag. Pure
            side-channel data — never blocks the exit, never touches the model.
            Chips stagger in last (handled inside ReasonChips). */}
        {r.reasonDirection && r.eventId ? (
          <ReasonChips eventId={r.eventId} direction={r.reasonDirection} category={r.category} />
        ) : null}

        {/* CTA zone — rides the bottom of the flow (not pinned), single primary
            action + a quiet text exit, with a generous bottom margin. */}
        <View style={ctaBlock}>
          <Text style={ritualText}>{r.ritualLine}</Text>
          <AppButton label="See my Reclaim" variant="indigo" fullWidth onPress={r.onSeeWhenbee} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            onPress={r.onBackToToday}
            style={quietExit}
          >
            <AppText style={quietExitText}>Back to today</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
