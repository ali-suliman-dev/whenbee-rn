import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
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

/** Human noun for a context dimension key. */
const KEY_NOUN: Record<string, string> = { energy: 'energy', sleep: 'sleep', meds: 'meds' };

/** Human phrasing for a value within a dimension. */
function valueLabel(key: string, value: string): string {
  if (key === 'energy') return `${value}-energy`;
  return value;
}

export function ContextCorrelations({ correlations }: { correlations: ContextCorrelation[] }) {
  const t = useTheme();
  const top = correlations[0];
  if (!top) return null;

  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const meta: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  const noun = KEY_NOUN[top.key] ?? top.key;
  const headlineText = `Your ${valueLabel(top.key, top.bestValue)} sessions land closest.`;
  const detailText = `About ${top.bestAccuracy}% accurate on ${valueLabel(top.key, top.bestValue)} sessions, vs ${top.worstAccuracy}% on ${valueLabel(top.key, top.worstValue)} ones.`;
  const metaText = `Based on the ${noun} you noted across ${top.sampleCount} sessions · learned on-device`;

  return (
    <PatternCard eyebrow="WHAT MOVES YOUR ACCURACY" icon="battery-half-outline" dismissLabel="Hide what moves your accuracy">
      <View style={block}>
        <Text style={headline}>{headlineText}</Text>
        <Text style={detail}>{detailText}</Text>
        <Text style={meta}>{metaText}</Text>
      </View>
    </PatternCard>
  );
}
