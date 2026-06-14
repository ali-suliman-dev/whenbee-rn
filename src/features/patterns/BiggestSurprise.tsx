import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { PatternCard } from './PatternCard';
import type { BiggestSurpriseCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// BiggestSurprise (S6) — the single log this week with the largest gap between
// guess and reality. A curiosity, not a callout: "Huh, that one ran longer."
// ──────────────────────────────────────────────────────────────────────────────

export function BiggestSurprise({ card }: { card: BiggestSurpriseCard }) {
  const t = useTheme();

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const block: ViewStyle = { gap: t.space[1.5] };

  const ranLonger = card.actualMin > card.estimateMin;
  const headlineText = ranLonger
    ? `${card.categoryName} stretched the most this week.`
    : `${card.categoryName} wrapped up early this week.`;

  return (
    <PatternCard eyebrow="THIS WEEK'S SURPRISE" icon="bulb-outline" dismissLabel="Hide this week's surprise">
      <View style={block}>
        <Text style={headline}>{headlineText}</Text>
        <Text style={detail}>
          You guessed {card.estimateMin} min and it took {card.actualMin}. Worth a mental note for next time.
        </Text>
      </View>
    </PatternCard>
  );
}
