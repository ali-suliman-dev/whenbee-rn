import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
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

  const lead: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const numberRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[3], flexWrap: 'wrap' };
  const multNote: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, paddingBottom: t.space[1] };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <PatternCard eyebrow="WHAT TO EXPECT" icon="time-outline" dismissLabel="Hide the prediction">
      <Text style={lead}>A typical {card.categoryName.toLowerCase()} task usually runs</Text>
      <View style={numberRow}>
        <HonestNumber size="xl" tone="indigo" value={`~${card.honestForFifteen}`} unit="min" />
        <Text style={multNote}>about {card.multiplier.toFixed(1)}× your guess</Text>
      </View>
      <Text style={note}>
        From your last {card.sampleSize} {card.sampleSize === 1 ? 'task' : 'tasks'}, for a 15-min guess.
      </Text>
    </PatternCard>
  );
}
