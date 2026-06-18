import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { GapLine } from './GapLine';
import { OptimismNudge } from './OptimismNudge';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FocusCard — Today's "next task" centerpiece (before start). The honest number is
// the hero (right, baseline-aligned with the title); the guess→plan gap is the bar;
// the context line states the learned gap (amber) and the finish projection; one
// full-width indigo Start button is the single filled-indigo affordance. No play
// coin, no eyebrow dot, no focal top border — flat surface, calm hierarchy.
// ──────────────────────────────────────────────────────────────────────────────

interface FocusCardProps {
  category: string;
  categoryLabel: string;
  taskTitle: string;
  summary: CalibrationSummary;
  /** Projected finish clock, e.g. "4:11pm" (computed by the screen from now + honest). */
  finishClock: string;
  onStart: () => void;
}

export function FocusCard({ category, categoryLabel, taskTitle, summary, finishClock, onStart }: FocusCardProps) {
  const t = useTheme();

  const delta = summary.honestMinutes - summary.guessMinutes;
  const showNudge = summary.basis === 'personal' && summary.honestMinutes > summary.guessMinutes;

  const eyebrowText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontSize: t.fontSize['2xs'],
    letterSpacing: 1.5,
    lineHeight: 12,
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
  const contextRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const guessLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const learnedBadge: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const learnedBadgeText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
    color: t.colors.amberText,
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
  };
  const finishLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontVariant: ['tabular-nums'],
  };

  return (
    <Card tone="raised" style={{ gap: t.space[4] }}>
      <View style={header}>
        <View style={{ flex: 1, gap: t.space[1.5] }}>
          <Text style={eyebrow}>NEXT · {categoryLabel.toUpperCase()}</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] }}>
          <Text style={guessLabel}>guessed {summary.guessMinutes}</Text>
          {delta > 0 ? (
            <View style={learnedBadge}>
              <Text style={learnedBadgeText}>+{delta} learned</Text>
            </View>
          ) : null}
        </View>
        <Text style={finishLabel}>done {finishClock}</Text>
      </View>

      <AppButton
        label="Start"
        variant="indigo"
        fullWidth
        icon={<Ionicons name="play" size={t.iconSize.sm} color={t.colors.onIndigo} />}
        onPress={onStart}
      />

      {showNudge ? (
        <OptimismNudge
          honestMin={summary.honestMinutes}
          category={category}
          guessMin={summary.guessMinutes}
          multiplier={summary.multiplier}
        />
      ) : null}
    </Card>
  );
}
