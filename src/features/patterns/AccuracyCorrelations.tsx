import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { AccuracyCorrelation } from '@/src/engine';
import { PatternCard } from './PatternCard';

// ──────────────────────────────────────────────────────────────────────────────
// AccuracyCorrelations (S3, Pro) — "when you're sharpest". Reads the user's own
// completed logs for a rhythm: the time of day and the day of week their guesses
// land closest. Curiosity, never blame — a worse window isn't a failure, it's just
// where a little more buffer helps. Renders nothing until a real pattern clears
// the engine's gates.
// ──────────────────────────────────────────────────────────────────────────────

function headlineFor(t: TFunction<'patterns'>, c: AccuracyCorrelation): string {
  return c.dimension === 'time'
    ? t('accuracyCorrelations.headline.time', { label: c.betterLabel })
    : t('accuracyCorrelations.headline.day', { label: c.betterLabel });
}

function detailFor(t: TFunction<'patterns'>, c: AccuracyCorrelation): string {
  const values = {
    betterAccuracy: c.betterAccuracy,
    betterLabel: c.betterLabel,
    worseAccuracy: c.worseAccuracy,
    worseLabel: c.worseLabel,
  };
  return c.dimension === 'time'
    ? t('accuracyCorrelations.detail.time', values)
    : t('accuracyCorrelations.detail.day', values);
}

export function AccuracyCorrelations({
  correlations,
}: {
  correlations: AccuracyCorrelation[];
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const top = correlations[0];
  if (!top) return null;
  const second = correlations[1];

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  // dismissId: encodes the top correlation's dimension + label pair so a genuinely
  // different pattern (new dimension or label) produces a new id and shows again.
  const dismissId = `accuracy-correlations:${top.dimension}:${top.betterLabel}:${top.sampleCount}`;

  return (
    <PatternCard
      eyebrow={tr('accuracyCorrelations.eyebrow')}
      icon="time-outline"
      dismissLabel={tr('accuracyCorrelations.dismissLabel')}
      dismissId={dismissId}
    >
      <View style={block}>
        <Text style={headline}>{headlineFor(tr, top)}</Text>
        <Text style={detail}>{detailFor(tr, top)}</Text>
        {second ? <Text style={detail}>{detailFor(tr, second)}</Text> : null}
        <Text style={meta}>{tr('accuracyCorrelations.meta', { count: top.sampleCount })}</Text>
      </View>
    </PatternCard>
  );
}
