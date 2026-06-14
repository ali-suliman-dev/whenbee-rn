import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { PatternCard } from './PatternCard';
import type { CalibrationMapRow } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// CalibrationMap (S10) — a per-category honest-vs-guess overview. One row per
// category: name on the left, the honest number on the right with a quiet "vs 15
// guess" beneath. Sibling rows share identical structure so the numbers align on a
// single right edge (one gap source per axis, no per-row margins).
// ──────────────────────────────────────────────────────────────────────────────

export function CalibrationMap({ rows }: { rows: CalibrationMapRow[] }) {
  const t = useTheme();

  const list: ViewStyle = { gap: t.space[3] };
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const leftCol: ViewStyle = { flex: 1, gap: t.space[0.5] };
  const rightCol: ViewStyle = { alignItems: 'flex-end' };
  const name: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const honest: TextStyle = {
    ...(type.multiplier as unknown as TextStyle),
    color: t.colors.primary,
  };
  const honestUnit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const honestRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[1] };

  return (
    <PatternCard eyebrow="YOUR HONEST MAP" icon="map-outline" dismissLabel="Hide your honest map">
      <View style={list}>
        {rows.map((r) => (
          <View key={r.categoryId} style={row}>
            <View style={leftCol}>
              <Text style={name} numberOfLines={1}>
                {r.categoryName}
              </Text>
              <Text style={sub}>
                {r.sampleSize} {r.sampleSize === 1 ? 'log' : 'logs'} · runs {r.multiplier.toFixed(1)}×
              </Text>
            </View>
            <View style={rightCol}>
              <View style={honestRow}>
                <Text style={honest}>~{r.honestMin}</Text>
                <Text style={honestUnit}>min</Text>
              </View>
              <Text style={sub}>vs {r.guessMin} guess</Text>
            </View>
          </View>
        ))}
      </View>
    </PatternCard>
  );
}
