import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** A blame-free time/weekday tail for the detail line, or '' when there's no skew. */
function skewSuffix(insight: ReasonInsight): string {
  if (insight.timeSkew === 'afternoon') return ', mostly later in the day';
  if (insight.timeSkew === 'morning') return ', mostly earlier in the day';
  if (insight.weekdaySkew !== null) {
    const day = WEEKDAYS[insight.weekdaySkew];
    if (day) return `, mostly on ${day}s`;
  }
  return '';
}

export function StealsYourTime({ insights }: { insights: ReasonInsight[] }) {
  const t = useTheme();
  const top = insights[0];
  if (!top) return null;

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  const pct = Math.round(top.share * 100);
  const headlineText = `Where ${top.categoryName}'s extra minutes go.`;
  const detailText = `${pct}% of ${top.categoryName} overruns trace back to ${reasonPhrase(top.reason)}${skewSuffix(top)}.`;
  const metaText = `Based on ${top.sampleCount} of ${top.totalOver} times you noted why · learned on-device`;

  return (
    <PatternCard
      eyebrow="WHAT STEALS YOUR TIME"
      icon="hourglass-outline"
      dismissLabel="Hide what steals your time"
    >
      <View style={block}>
        <Text style={headline}>{headlineText}</Text>
        <Text style={detail}>{detailText}</Text>
        <Text style={meta}>{metaText}</Text>
      </View>
    </PatternCard>
  );
}
