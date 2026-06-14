import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { PatternCard } from './PatternCard';
import type { DriftAlertCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// DriftAlert (S9) — "what changed?": a category whose pace shifted between its
// earliest and most recent logs. Neutral by design — it names a shift, never a
// fault. Pace changes (sleep, meds, season, life) are information, not a problem.
// ──────────────────────────────────────────────────────────────────────────────

export function DriftAlert({ card }: { card: DriftAlertCard }) {
  const t = useTheme();

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const block: ViewStyle = { gap: t.space[1.5] };

  const headlineText = card.slowerLately
    ? `${card.categoryName} is taking a bit longer lately.`
    : `${card.categoryName} is moving quicker lately.`;

  return (
    <PatternCard eyebrow="WHAT CHANGED" icon="swap-vertical-outline" dismissLabel="Hide what changed">
      <View style={block}>
        <Text style={headline}>{headlineText}</Text>
        <Text style={detail}>
          It used to run about {card.earlyMultiplier.toFixed(1)}× your guess; recently it&apos;s nearer{' '}
          {card.recentMultiplier.toFixed(1)}×. Your honest numbers already follow along.
        </Text>
      </View>
    </PatternCard>
  );
}
