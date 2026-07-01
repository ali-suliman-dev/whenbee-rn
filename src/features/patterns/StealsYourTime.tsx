import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { reasonPhrase } from '@/src/engine';
import type { ReasonInsight } from '@/src/domain/types';
import { PatternCard } from './PatternCard';

// ──────────────────────────────────────────────────────────────────────────────
// StealsYourTime (S12, Pro) — the single clearest pattern in a user's own
// over-run notes: where one category's extra minutes keep coming from. Curiosity,
// never blame — the cause is phrased as a thing that happens ("getting pulled
// away"), not a fault, and the provenance line shows it's read straight from the
// notes the user chose to leave, on-device. Renders nothing until there's a top
// insight to show.
// ──────────────────────────────────────────────────────────────────────────────

const WEEKDAY_SKEW_KEYS = [
  'stealsYourTime.skew.weekday.sunday',
  'stealsYourTime.skew.weekday.monday',
  'stealsYourTime.skew.weekday.tuesday',
  'stealsYourTime.skew.weekday.wednesday',
  'stealsYourTime.skew.weekday.thursday',
  'stealsYourTime.skew.weekday.friday',
  'stealsYourTime.skew.weekday.saturday',
] as const;

/** A blame-free time/weekday tail for the detail line, or '' when there's no skew. */
function skewSuffix(tr: TFunction<'patterns'>, insight: ReasonInsight): string {
  if (insight.timeSkew === 'afternoon') return tr('stealsYourTime.skew.afternoon');
  if (insight.timeSkew === 'morning') return tr('stealsYourTime.skew.morning');
  if (insight.weekdaySkew !== null) {
    const key = WEEKDAY_SKEW_KEYS[insight.weekdaySkew];
    if (key) return tr(key);
  }
  return '';
}

export function StealsYourTime({ insights }: { insights: ReasonInsight[] }) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const top = insights[0];
  if (!top) return null;

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  const pct = Math.round(top.share * 100);
  const headlineText = tr('stealsYourTime.headline', { category: top.categoryName });
  const detailText = tr('stealsYourTime.detail', {
    pct,
    category: top.categoryName,
    reason: reasonPhrase(top.reason),
    skew: skewSuffix(tr, top),
  });
  const metaText = tr('stealsYourTime.meta', { sampleCount: top.sampleCount, totalOver: top.totalOver });

  // dismissId: categoryId + reason + sampleCount so a new data batch or new top
  // reason (genuinely-different insight) produces a fresh id and shows again.
  const dismissId = `steals:${top.categoryId}:${top.reason}:${top.sampleCount}`;

  return (
    <PatternCard
      eyebrow={tr('stealsYourTime.eyebrow')}
      icon="hourglass-outline"
      dismissLabel={tr('stealsYourTime.dismissLabel')}
      dismissId={dismissId}
    >
      <View style={block}>
        <Text style={headline}>{headlineText}</Text>
        <Text style={detail}>{detailText}</Text>
        <Text style={meta}>{metaText}</Text>
      </View>
    </PatternCard>
  );
}
