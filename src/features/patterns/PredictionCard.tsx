import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { HonestNumber } from '@/src/components/HonestNumber';
import { PatternCard } from './PatternCard';
import type { PredictionCard as PredictionCardData } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// PredictionCard (S7) — "X usually runs ~Nm." A forward-looking honest number for
// the category you have the most evidence on. The same number can ride Today/Timer;
// at minimum it lives here.
// ──────────────────────────────────────────────────────────────────────────────

export function PredictionCard({ card }: { card: PredictionCardData }) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');

  const lead: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const numberRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[3], flexWrap: 'wrap' };
  const multNote: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, paddingBottom: t.space[1] };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };

  // dismissId: categoryId + sampleSize — a new observation batch (different count)
  // refreshes the prediction; same category + count stays dismissed.
  const dismissId = `prediction:${card.categoryId}:${card.sampleSize}`;

  return (
    <PatternCard
      eyebrow={tr('predictionCard.eyebrow')}
      icon="time-outline"
      dismissLabel={tr('predictionCard.dismissLabel')}
      dismissId={dismissId}
    >
      <Text style={lead}>{tr('predictionCard.lead', { category: card.categoryName.toLowerCase() })}</Text>
      <View style={numberRow}>
        <HonestNumber size="xl" tone="indigo" value={`~${card.honestForFifteen}`} unit={tr('predictionCard.unit')} />
        <Text style={multNote}>{tr('predictionCard.multNote', { multiplier: card.multiplier.toFixed(1) })}</Text>
      </View>
      <Text style={note}>{tr('predictionCard.note', { count: card.sampleSize })}</Text>
    </PatternCard>
  );
}
