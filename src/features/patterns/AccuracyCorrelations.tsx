import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
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

function headlineFor(c: AccuracyCorrelation): string {
  return c.dimension === 'time'
    ? `Your estimates land closest in the ${c.betterLabel}.`
    : `${c.betterLabel} is your sharpest day.`;
}

function detailFor(c: AccuracyCorrelation): string {
  const prep = c.dimension === 'time' ? 'in the' : 'on';
  return `About ${c.betterAccuracy}% accurate ${prep} ${c.betterLabel}, vs ${c.worseAccuracy}% ${prep} ${c.worseLabel}.`;
}

export function AccuracyCorrelations({
  correlations,
}: {
  correlations: AccuracyCorrelation[];
}) {
  const t = useTheme();
  const top = correlations[0];
  if (!top) return null;
  const second = correlations[1];

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  return (
    <PatternCard eyebrow="WHEN YOU'RE SHARPEST" icon="time-outline" dismissLabel="Hide when you're sharpest">
      <View style={block}>
        <Text style={headline}>{headlineFor(top)}</Text>
        <Text style={detail}>{detailFor(top)}</Text>
        {second ? <Text style={detail}>{detailFor(second)}</Text> : null}
        <Text style={meta}>Based on {top.sampleCount} logs · learned on-device</Text>
      </View>
    </PatternCard>
  );
}
