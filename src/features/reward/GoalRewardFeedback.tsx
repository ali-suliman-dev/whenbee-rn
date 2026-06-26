import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { GoalLogFeedback } from './useReward';

// ──────────────────────────────────────────────────────────────────────────────
// GoalRewardFeedback — the post-log goal coach line on the Reward screen (spec
// 2026-06-26-goal-coach §4). Self-relative + never-negative (Gentler-Streak
// voice): worst case is "typical", never "behind". Amber, calm, no streak.
// ──────────────────────────────────────────────────────────────────────────────

/** Verdict → the leading sentence. `typical` stays neutral, never a deficit. */
function headlineFor(thisBand: number, quality: GoalLogFeedback['quality']): string {
  const base = `That one landed within ${thisBand}%`;
  if (quality === 'tightest_week') return `${base} — your tightest this week.`;
  if (quality === 'tighter_than_usual') return `${base} — tighter than usual.`;
  return `${base}.`;
}

export function GoalRewardFeedback({ feedback }: { feedback: GoalLogFeedback }) {
  const t = useTheme();

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[2.5],
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[3],
  };
  const iconWell: ViewStyle = {
    width: t.space[6],
    height: t.space[6],
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.accentCoin,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const line: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };
  const caption: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.amberText,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: t.space[0.5],
  };

  return (
    <View style={card} accessibilityLabel={headlineFor(feedback.thisBand, feedback.quality)}>
      <View style={iconWell}>
        <Ionicons name="checkmark" size={t.iconSize.sm} color={t.colors.amberText} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={line}>{headlineFor(feedback.thisBand, feedback.quality)}</AppText>
        <AppText style={caption}>toward your ±{feedback.targetBand}% goal</AppText>
      </View>
    </View>
  );
}
