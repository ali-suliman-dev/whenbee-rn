import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { HonestNumber } from '@/src/components/HonestNumber';
import { PatternCard } from './PatternCard';
import type { YouVsPastCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// YouVsPast (S5) — your accuracy now vs your first logs. Growth, framed kindly. A
// flat delta reads as "steady", never as falling behind — there is no loss state.
// ──────────────────────────────────────────────────────────────────────────────

export function YouVsPast({ card }: { card: YouVsPastCard }) {
  const t = useTheme();

  const columns: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[6] };
  const col: ViewStyle = { gap: t.space[1] };
  const label: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const note: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  const improving = card.delta > 0;
  const summary = improving
    ? `That's ${card.delta} points sharper than when you started. Nice work.`
    : 'Right where you started — and steady reads are a real skill.';

  // dismissId: encodes the exact accuracy pair so a meaningfully different reading
  // (either score changes by a point) produces a new id and shows again.
  const dismissId = `you-vs-past:${card.earlyAccuracy}:${card.recentAccuracy}`;

  return (
    <PatternCard eyebrow="YOU, THEN VS NOW" icon="trending-up-outline" dismissLabel="Hide your progress" dismissId={dismissId}>
      <View style={columns}>
        <View style={col}>
          <Text style={label}>At first</Text>
          <HonestNumber size="big" tone="ink" value={`${card.earlyAccuracy}`} unit="%" />
        </View>
        <View style={col}>
          <Text style={label}>Lately</Text>
          <HonestNumber size="big" tone={improving ? 'indigo' : 'ink'} value={`${card.recentAccuracy}`} unit="%" />
        </View>
      </View>
      <Text style={note}>{summary}</Text>
    </PatternCard>
  );
}
