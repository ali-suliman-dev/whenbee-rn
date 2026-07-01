import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { GoalLogFeedback } from './useReward';

// ──────────────────────────────────────────────────────────────────────────────
// GoalRewardFeedback — the post-log goal coach line on the Reward screen (spec
// 2026-06-26-goal-coach §4). Self-relative + never-negative (Gentler-Streak
// voice): worst case is "typical", never "behind". Amber, calm, no streak.
// ──────────────────────────────────────────────────────────────────────────────

type GoalHeadlineKey =
  | 'goalFeedback.headline.tightestWeek'
  | 'goalFeedback.headline.tighterThanUsual'
  | 'goalFeedback.headline.typical';

/** Verdict → the leading sentence. `typical` stays neutral, never a deficit. */
function headlineFor(
  t: (key: GoalHeadlineKey, opts?: Record<string, unknown>) => string,
  thisBand: number,
  quality: GoalLogFeedback['quality'],
): string {
  if (quality === 'tightest_week') return t('goalFeedback.headline.tightestWeek', { band: thisBand });
  if (quality === 'tighter_than_usual')
    return t('goalFeedback.headline.tighterThanUsual', { band: thisBand });
  return t('goalFeedback.headline.typical', { band: thisBand });
}

export function GoalRewardFeedback({ feedback }: { feedback: GoalLogFeedback }) {
  const t = useTheme();
  const { t: tr } = useTranslation('reward');

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

  const headline = headlineFor(tr, feedback.thisBand, feedback.quality);

  return (
    <View style={card} accessibilityLabel={headline}>
      <View style={iconWell}>
        <Ionicons name="checkmark" size={t.iconSize.sm} color={t.colors.amberText} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={line}>{headline}</AppText>
        <AppText style={caption}>{tr('goalFeedback.caption', { band: feedback.targetBand })}</AppText>
      </View>
    </View>
  );
}
