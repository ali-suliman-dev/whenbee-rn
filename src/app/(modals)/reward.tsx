import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { HonestNumber } from '@/src/components/HonestNumber';
import { Screen } from '@/src/components/Screen';
import { ContextQuestions } from '@/src/features/reward/ContextQuestions';
import { HoneyBar } from '@/src/features/reward/HoneyBar';
import { GoalRewardFeedback } from '@/src/features/reward/GoalRewardFeedback';
import { NotifSoftAskCard } from '@/src/features/reward/NotifSoftAskCard';
import { RewardBee } from '@/src/features/reward/RewardBee';
import { useReward } from '@/src/features/reward/useReward';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ──────────────────────────────────────────────────────────────────────────────
// Reward (Screen 4) — the dopamine payoff: logging IS the reward. One read path,
// top→bottom: feel it (bee + headline) → see the payoff (hero number + honey) →
// optionally tag a reason → one clear way out.
//
// Three priority zones in a ScrollView (level-up + chips can exceed the sheet),
// CTA pinned to the bottom with the safe-area inset. THE one action navigates
// to the Whenbee hub; "Back to today" is a quiet text exit beneath it.
//
// Motion: a staggered top→bottom reveal (number rises in → honey fills as a
// complete unit → chips fade in last). Reduce-motion renders every final state still.
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
    fontSize: t.fontSize.xl, // 24 — a touch smaller than the global title (26) on this screen
    lineHeight: 29,
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
    gap: t.space[5], // wide tier — separates the four major zones (tightened to fit)
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
  // Left side groups the label + the folded-in multiplier on one cap-aligned row.
  const honeyLabelRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
  };
  const honeyLabel: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // The multiplier, folded out of its own subline into a quiet meta beside HONEY.
  const honeyMultiplier: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // Muted unit suffix — the "×" sits smaller than the number it trails.
  const honeyMultiplierUnit: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // The payoff card groups honey + multiplier into one unit. Borders
  // are 0 globally, so the grouping reads off the white fill on the lavender bg.
  const payoffCard: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[2.5], // medium tier — card internals (tightened with the row collapse)
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
        <View style={{ alignItems: 'center', gap: t.space[2] }}>
          {r.capEyebrow ? <Text style={capEyebrow}>{r.capEyebrow}</Text> : null}
          <RewardBee sealed={r.sealed} />
          <Text style={headlineText}>{r.headline}</Text>
        </View>

        {/* Zone 2 — hero stat (the single biggest element) */}
        <Animated.View style={[heroBlock, heroAnim]}>
          <Text style={tookEyebrow}>IT REALLY TOOK</Text>
          <HonestNumber
            size="lg"
            tone="ink"
            value={String(r.actualMin)}
            unit="min"
            unitSize={t.fontSize.lg}
          />
          <View style={deltaChip}>
            <Text style={deltaChipText}>{deltaLabel}</Text>
          </View>
        </Animated.View>

        {/* Zone 3 — payoff card (honey + multiplier as one complete unit).
            Two rows: header (HONEY · multiplier + %), the honey bar.
            The payoff lands as a single beat — no dangling delay. */}
        <View style={payoffCard}>
          <View style={honeyHeaderRow}>
            <View style={honeyLabelRow}>
              <Text style={honeyLabel}>HONEY</Text>
              <Text style={honeyMultiplier}>
                · {r.multiplier.toFixed(1)}
                <Text style={honeyMultiplierUnit}>×</Text>
              </Text>
            </View>
            <HonestNumber value={String(r.honeyPct)} unit="%" size="inline" tone="amberText" />
          </View>
          <HoneyBar pct={r.honeyPct} />
        </View>

        {/* Goal coach — post-log feedback for a goaled category (self-relative,
            never-negative). Renders only when a goal is active. */}
        {r.goalFeedback ? <GoalRewardFeedback feedback={r.goalFeedback} /> : null}

        {/* Notification soft-ask — amber card, first calibration only, once.
            Predicate is in useNotifSoftAsk; this renders null when not needed. */}
        <NotifSoftAskCard />

        {/* Zone 4 — the "quick questions" card: reason (if diverged past the
            gate) then energy, asked one at a time via ContextQuestions.
            ContextQuestions owns its own card chrome (surface/radius/padding)
            so it can unmount that chrome too once every question is settled —
            it renders null rather than leaving an empty rounded box behind. */}
        {r.eventId ? (
          <ContextQuestions
            eventId={r.eventId}
            category={r.category}
            reasonDirection={r.reasonDirection}
          />
        ) : null}

        {/* CTA zone — rides the bottom of the flow (not pinned), single primary
            action + a quiet text exit, with a generous bottom margin. */}
        <View style={ctaBlock}>
          <Text style={ritualText}>{r.ritualLine}</Text>
          <AppButton label="See your bee" variant="indigo" fullWidth onPress={r.onSeeWhenbee} />
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
