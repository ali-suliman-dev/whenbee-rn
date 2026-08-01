import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ContextCorrelation } from '@/src/engine';
import { PatternCard } from './PatternCard';

// ──────────────────────────────────────────────────────────────────────────────
// ContextCorrelations (S4, Pro) — "what moves your accuracy". Reads the optional
// context tags the user chose to leave (e.g. energy) against how close their
// estimates landed. Curiosity, never blame — a worse window just means leave a
// little more buffer there. Renders nothing until a real pattern clears the gate.
// ──────────────────────────────────────────────────────────────────────────────

const NOUN_KEY = {
  energy: 'contextCorrelations.noun.energy',
  sleep: 'contextCorrelations.noun.sleep',
  meds: 'contextCorrelations.noun.meds',
} as const;

/** Human noun for a context dimension key. */
function keyNoun(tr: TFunction<'patterns'>, key: string): string {
  if (key === 'energy' || key === 'sleep' || key === 'meds') return tr(NOUN_KEY[key]);
  return key;
}

/** Human phrasing for a value within a dimension. */
function valueLabel(tr: TFunction<'patterns'>, key: string, value: string): string {
  if (key === 'energy') return tr('contextCorrelations.valueLabel.energy', { value });
  return value;
}

export function ContextCorrelations({ correlations }: { correlations: ContextCorrelation[] }) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const top = correlations[0];
  if (!top) return null;

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  const noun = keyNoun(tr, top.key);
  const headlineText = tr('contextCorrelations.headline', { value: valueLabel(tr, top.key, top.bestValue) });
  const detailText = tr('contextCorrelations.detail', {
    bestAccuracy: top.bestAccuracy,
    bestValue: valueLabel(tr, top.key, top.bestValue),
    worstAccuracy: top.worstAccuracy,
    worstValue: valueLabel(tr, top.key, top.worstValue),
  });
  const metaText = tr('contextCorrelations.meta', { noun, count: top.sampleCount });

  // dismissId: key + bestValue + sampleCount so a genuinely different correlation
  // (new dimension or new sample batch) produces a new id and shows again.
  const dismissId = `context:${top.key}:${top.bestValue}:${top.sampleCount}`;

  return (
    <PatternCard
      eyebrow={tr('contextCorrelations.eyebrow')}
      icon="battery-half-outline"
      dismissLabel={tr('contextCorrelations.dismissLabel')}
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
