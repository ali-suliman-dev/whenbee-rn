import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { GapLine } from './GapLine';
import { OptimismNudge } from './OptimismNudge';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FocusCard — the Today centerpiece (before start). One compact row:
//
//   (▶)  ● NEXT · OUT THE DOOR          PLAN FOR
//        Test 2                          ~10 min
//   ┃indigo·············amber┃           (gap line)
//   guessed 5 min                        +5 min
//
// The whole card is the Start trigger (press = scale feedback); the indigo play
// coin is the affordance + the screen's one indigo fill. The plan (honest) total
// is the hero number; the guess lives on the line, the +minutes is amber — a fact,
// never a scold. Focal tone keeps the single restrained indigo top edge.
// ──────────────────────────────────────────────────────────────────────────────

interface FocusCardProps {
  /** Category slug (e.g. "getting-ready") — for analytics + the nudge event. */
  category: string;
  categoryLabel: string;
  taskTitle: string;
  summary: CalibrationSummary;
  onStart: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FocusCard({ category, categoryLabel, taskTitle, summary, onStart }: FocusCardProps) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  function pressIn() {
    if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
  }
  function pressOut() {
    if (!reduced) scale.set(withSpring(1, t.motion.spring));
  }

  const delta = summary.honestMinutes - summary.guessMinutes;
  // The nudge earns its scarce amber spot only with personal evidence AND when the
  // honest number actually beats the guess — never on the prior fallback.
  const showNudge = summary.basis === 'personal' && summary.honestMinutes > summary.guessMinutes;

  // Eyebrows here run a touch smaller than the global role — a quiet micro-label
  // above the loud title / hero number (clearer hierarchy, more air on the row).
  const eyebrowText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontSize: t.fontSize['2xs'],
    letterSpacing: 1.5,
    lineHeight: 12,
  };

  const topline: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const coin: ViewStyle = {
    width: t.size.coin,
    height: t.size.coin,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };
  const eyebrow: TextStyle = { ...eyebrowText, color: t.colors.inkSoft };
  const title: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };
  const rightCol: ViewStyle = { alignItems: 'flex-end', gap: t.space[1.5] };
  const miniHdr: TextStyle = { ...eyebrowText, color: t.colors.inkFaint };

  const labelsRow: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' };
  const guessLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.primary };
  const extraLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Inter-Bold',
    fontVariant: ['tabular-nums'],
  };

  return (
    <AnimatedPressable
      onPress={onStart}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`${taskTitle}, ${categoryLabel}. Plan for about ${summary.honestMinutes} minutes, you guessed ${summary.guessMinutes}. Tap to start.`}
      style={pressStyle}
    >
      <Card tone="focal" style={{ gap: t.space[4] }}>
        <View style={topline}>
          <View style={coin}>
            <Ionicons name="play" size={t.iconSize.md} color={t.colors.onIndigo} style={{ marginLeft: t.space[0.5] }} />
          </View>
          <View style={{ flex: 1, gap: t.space[1.5] }}>
            <View style={eyebrowRow}>
              <View style={dot} />
              <Text style={eyebrow}>NEXT · {categoryLabel.toUpperCase()}</Text>
            </View>
            <Text style={title} numberOfLines={1}>
              {taskTitle}
            </Text>
          </View>
          <View style={rightCol}>
            <Text style={miniHdr}>PLAN FOR</Text>
            <HonestNumber
              size="big"
              tone="ink"
              value={`~${summary.honestMinutes}`}
              unit="min"
              unitSize={t.fontSize.base}
            />
          </View>
        </View>

        <GapLine guessMin={summary.guessMinutes} honestMin={summary.honestMinutes} />

        <View style={labelsRow}>
          <Text style={guessLabel}>guessed {summary.guessMinutes} min</Text>
          {delta > 0 ? <Text style={extraLabel}>+{delta} min</Text> : null}
        </View>

        {showNudge ? (
          <OptimismNudge
            honestMin={summary.honestMinutes}
            category={category}
            guessMin={summary.guessMinutes}
            multiplier={summary.multiplier}
          />
        ) : null}
      </Card>
    </AnimatedPressable>
  );
}
