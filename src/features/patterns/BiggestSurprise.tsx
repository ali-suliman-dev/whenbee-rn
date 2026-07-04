import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation('patterns');

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const block: ViewStyle = { gap: t.space[1.5] };

  const ranLonger = card.actualMin > card.estimateMin;
  const headlineText = ranLonger
    ? tr('biggestSurprise.headline.longer', { category: card.categoryName })
    : tr('biggestSurprise.headline.early', { category: card.categoryName });

  // dismissId: "surprise:{categoryId}:{estimateMin}x{actualMin}" — stable for
  // this exact task result; a new week's surprise (different numbers) gets a
  // fresh id and is NOT pre-dismissed.
  const dismissId = `surprise:${card.categoryId}:${card.estimateMin}x${card.actualMin}`;

  return (
    <PatternCard
      eyebrow={tr('biggestSurprise.eyebrow')}
      icon="bulb-outline"
      dismissLabel={tr('biggestSurprise.dismissLabel')}
      dismissId={dismissId}
    >
      <View style={block}>
        <Text style={headline}>{headlineText}</Text>
        <Text style={detail}>
          {tr('biggestSurprise.detail', { estimateMin: card.estimateMin, actualMin: card.actualMin })}
        </Text>
      </View>
    </PatternCard>
  );
}
