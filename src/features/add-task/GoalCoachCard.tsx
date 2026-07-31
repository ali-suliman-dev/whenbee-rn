import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trans, useTranslation } from 'react-i18next';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { GoalCoachInfo } from '@/src/stores/calibrationStore';
import { bucketLabel } from '@/src/i18n/bucketLabel';

// ──────────────────────────────────────────────────────────────────────────────
// GoalCoachCard — read-only add-sheet goal status (spec 2026-07-13-goal-lever-
// coach). Where the user stands on their active goal (forward-only meter +
// countable inside-band line) and the learned time-of-day lever, strength-first.
// It depends ONLY on the category's goal + logs — never the live guess — and is
// deliberately non-interactive: the old "Use Xm" apply button fed the engine its
// own output (15→25→40→60) and polluted calibration. Never re-add a button here.
// ──────────────────────────────────────────────────────────────────────────────

const BUCKET_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  mornings: 'sunny-outline',
  afternoons: 'partly-sunny-outline',
  evenings: 'moon-outline',
  'late nights': 'cloudy-night-outline',
};

export function GoalCoachCard({
  categoryName,
  info,
}: {
  categoryName: string;
  info: GoalCoachInfo;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('addTask');
  const { t: patternsT } = useTranslation('patterns');
  const { targetBand, bestBand, progress, insideCount, windowCount, lever } = info;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
  };
  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const chip: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[0.5],
  };
  const chipText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.amberText,
  };

  const meter: ViewStyle = { gap: t.space[1.5] };
  const meterHead: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  };
  const meterNowRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[1.5] };
  const meterNow: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const meterNowLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const meterGoal: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${Math.round(progress * 100)}%`,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };
  const countLine: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const leverRow: ViewStyle = { flexDirection: 'row', gap: t.space[2.5], alignItems: 'flex-start' };
  const iconWell: ViewStyle = {
    width: t.space[6],
    height: t.space[6],
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const leverLine: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const strong: TextStyle = { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' };

  const bestBucket = lever ? bucketLabel(patternsT, lever.bestValue) : '';
  const worstBucket = lever ? bucketLabel(patternsT, lever.worstValue) : '';
  const a11y =
    tr('goalCoach.a11y', { category: categoryName, bestBand, targetBand }) +
    (windowCount > 0
      ? tr('goalCoach.a11yInside', { inside: insideCount, count: windowCount })
      : '') +
    (lever
      ? tr('goalCoach.a11yLever', {
          best: bestBucket,
          bestBand: lever.bestBand,
          worstBand: lever.worstBand,
          worst: worstBucket,
        })
      : '');

  return (
    <View style={card} accessible accessibilityLabel={a11y}>
      <View style={headRow}>
        <AppText style={eyebrow}>{tr('goalCoach.eyebrow', { category: categoryName })}</AppText>
        <View style={chip}>
          <AppText style={chipText}>{tr('goalCoach.chip', { band: targetBand })}</AppText>
        </View>
      </View>

      <View style={meter}>
        <View style={meterHead}>
          <View style={meterNowRow}>
            <AppText style={meterNow}>±{bestBand}%</AppText>
            <AppText style={meterNowLabel}>{tr('goalCoach.bestSoFar')}</AppText>
          </View>
          <AppText style={meterGoal}>±{targetBand}%</AppText>
        </View>
        <View style={track}>
          <View style={fill} />
        </View>
        {windowCount > 0 ? (
          <AppText style={countLine}>
            {tr('goalCoach.insideBand', { inside: insideCount, count: windowCount })}
          </AppText>
        ) : null}
      </View>

      {lever ? (
        <View style={leverRow}>
          <View style={iconWell}>
            <Ionicons
              name={BUCKET_ICON[lever.bestValue] ?? 'sunny-outline'}
              size={t.iconSize.sm}
              color={t.colors.amberText}
            />
          </View>
          <AppText style={leverLine}>
            <Trans
              i18nKey="goalCoach.lever"
              ns="addTask"
              values={{
                best: bestBucket,
                bestBand: lever.bestBand,
                worstBand: lever.worstBand,
                worst: worstBucket,
              }}
              components={{ strong: <AppText style={strong} /> }}
            />
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
