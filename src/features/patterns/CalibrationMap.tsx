import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CalibrationConfidence } from '@/src/domain/types';
import { PatternCard } from './PatternCard';
import type { CalibrationMapRow } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// CalibrationMap (S10–S12) — a per-category honest-vs-guess overview. One row per
// category: name + a 3-step readiness dial on the left, the honest number on the
// right with a quiet "vs 15 guess" beneath. Sibling rows share identical structure
// so the numbers align on a single right edge (one gap source per axis, no per-row
// margins). The dial (Raw → Setting → Honest) is the Earned-Readiness axis — kept
// SEPARATE from the honey tier, and never framed as a deficit. A header line reads
// how many areas have settled into honest numbers.
// ──────────────────────────────────────────────────────────────────────────────

const DIAL_STEPS: CalibrationConfidence[] = ['raw', 'setting', 'honest'];

/** Steps lit, 1–3, for each readiness stage. */
function filledSteps(confidence: CalibrationConfidence): number {
  if (confidence === 'honest') return 3;
  if (confidence === 'setting') return 2;
  return 1;
}

function ConfidenceDial({ confidence }: { confidence: CalibrationConfidence }) {
  const t = useTheme();
  const lit = filledSteps(confidence);
  const dial: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const pipBase: ViewStyle = {
    width: t.space[2],
    height: t.space[1],
    borderRadius: t.radii.full,
  };
  return (
    <View
      style={dial}
      accessibilityRole="progressbar"
      accessibilityLabel={`Readiness: ${lit} of 3`}
    >
      {DIAL_STEPS.map((step, i) => (
        <View
          key={step}
          style={[pipBase, { backgroundColor: i < lit ? t.colors.primary : t.colors.inkFaint }]}
        />
      ))}
    </View>
  );
}

/** Warm, no-guilt framing from the row mix. Settled areas are celebrated; the rest
 *  are simply "still settling" — never behind, never a chore. */
function readinessLine(rows: CalibrationMapRow[]): string {
  const honest = rows.filter((r) => r.confidence === 'honest').length;
  if (honest === 0) return 'Your areas are still settling. A few more logs and the numbers sharpen.';
  if (honest === 1) return 'One area reads honest now. The rest are catching up.';
  if (honest === rows.length) return 'Every area reads honest now. Your numbers are yours.';
  return `${honest} of your areas read honest now.`;
}

export function CalibrationMap({ rows }: { rows: CalibrationMapRow[] }) {
  const t = useTheme();

  const list: ViewStyle = { gap: t.space[3] };
  const lead: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const leftCol: ViewStyle = { flex: 1, gap: t.space[1] };
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
        <Text style={lead}>{readinessLine(rows)}</Text>
        {rows.map((r) => (
          <View key={r.categoryId} style={row}>
            <View style={leftCol}>
              <Text style={name} numberOfLines={1}>
                {r.categoryName}
              </Text>
              <ConfidenceDial confidence={r.confidence} />
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
