import { useEffect, useCallback } from 'react';
import { View, Text, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { GapLine } from './GapLine';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FocusCard — Today's "next task" centerpiece (before start). The honest number is
// the hero (right, baseline-aligned with the title); the guess→plan gap is the bar;
// the context line states the learned gap and the finish projection; one full-width
// indigo Start button (shallow coin-edge) is the single filled-indigo affordance.
// ONE amber on the card: the gap bar + the plain `+ N learned` text encode the
// optimism signal once — no separate nudge pill, no badge box (amber states a fact,
// never a scold). No play coin, no eyebrow dot, no focal top border — flat surface,
// calm hierarchy.
// ──────────────────────────────────────────────────────────────────────────────

interface FocusCardProps {
  categoryLabel: string;
  taskTitle: string;
  summary: CalibrationSummary;
  /** Projected finish clock, e.g. "4:11pm" (computed by the screen from now + honest). */
  finishClock: string;
  onStart: () => void;
  /** Delete this task (the long-press sheet's Remove). */
  onDelete?: () => void;
  /** When true, slide the card left off-screen then call onDelete — matches TaskRow's exit. */
  isExiting?: boolean;
}

export function FocusCard({
  categoryLabel,
  taskTitle,
  summary,
  finishClock,
  onStart,
  onDelete,
  isExiting = false,
}: FocusCardProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
  const { width: screenWidth } = useWindowDimensions();

  // Mirror TaskRow's departure: slide left off-screen, then commit the delete on
  // finish — so the Next card leaves with the same motion as the Up Next rows
  // instead of vanishing the instant the store updates.
  const exitX = useSharedValue(0);
  const exitStyle = useAnimatedStyle(() => ({ transform: [{ translateX: exitX.get() }] }));

  const triggerOnDelete = useCallback(() => {
    onDelete?.();
  }, [onDelete]);

  useEffect(() => {
    if (!isExiting) return;
    exitX.set(
      withTiming(
        -screenWidth,
        { duration: t.motion.base, easing: Easing.in(Easing.ease) },
        (finished) => {
          'worklet';
          if (finished) runOnJS(triggerOnDelete)();
        },
      ),
    );
    // exitX and triggerOnDelete are stable; screenWidth only changes on rotation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExiting]);

  const delta = summary.honestMinutes - summary.guessMinutes;

  const eyebrowText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontSize: t.fontSize['2xs'],
    letterSpacing: 1.5,
    // 1.5× the override fontSize — absolute RN lineHeight (tokens.lineHeight are ratios)
    lineHeight: t.fontSize['2xs'] * 1.5,
  };
  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: t.space[3],
  };
  const eyebrow: TextStyle = { ...eyebrowText, color: t.colors.inkSoft };
  const title: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };
  const contextRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const guessLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // The learned gap is plain amber bold text (no pill box) — the sole optimism cue.
  const learnedText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const finishLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontVariant: ['tabular-nums'],
  };
  return (
    <Animated.View style={exitStyle}>
      <Card tone="raised" style={{ gap: t.space[4] }}>
        <View style={header}>
          <View style={{ flex: 1, gap: t.space[1.5] }}>
            <Text style={eyebrow}>{tr('focusCard.eyebrow', { category: categoryLabel.toUpperCase() })}</Text>
            <Text style={title} numberOfLines={1}>
              {taskTitle}
            </Text>
          </View>
          <HonestNumber
            size="md"
            tone="ink"
            value={`~${summary.honestMinutes}`}
            unit="min"
            unitSize={t.fontSize.bodySm}
          />
        </View>

        <GapLine guessMin={summary.guessMinutes} honestMin={summary.honestMinutes} />

        <View style={contextRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1] }}>
            <Text style={guessLabel}>{tr('focusCard.guessed', { count: summary.guessMinutes })}</Text>
            {delta > 0 ? <Text style={learnedText}>{tr('focusCard.learned', { count: delta })}</Text> : null}
          </View>
          <Text style={finishLabel}>{tr('focusCard.done', { time: finishClock })}</Text>
        </View>

        <AppButton
          label={tr('focusCard.startButton')}
          variant="indigo"
          depth="shallow"
          fullWidth
          icon={<Ionicons name="play" size={t.iconSize.sm} color={t.colors.onIndigo} />}
          onPress={onStart}
        />
      </Card>
    </Animated.View>
  );
}
