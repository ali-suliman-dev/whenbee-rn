import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CalibrationConfidence } from '@/src/domain/types';
import type { CalibrationMapRow } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// HonestMap (S10–S12) — a per-category honest-vs-guess table. One row per
// category: name + runs N× · readiness on the left, amber 3-step readiness dial
// centre, honest number on the right with a quiet "vs N guess" beneath. Sibling
// rows share identical structure so the numbers align on a single right edge (one
// gap source per axis, no per-row margins). The dial (Raw → Setting → Honest) is
// the Earned-Readiness axis — kept SEPARATE from the honey tier, and never
// framed as a deficit. A header line reads how many areas have settled.
// ──────────────────────────────────────────────────────────────────────────────

const DIAL_STEPS: CalibrationConfidence[] = ['raw', 'setting', 'honest'];

const CONFIDENCE_KEY = {
  raw: 'honestMap.confidence.raw',
  setting: 'honestMap.confidence.setting',
  honest: 'honestMap.confidence.honest',
} as const;

/** Steps lit, 1–3, for each readiness stage. */
function filledSteps(confidence: CalibrationConfidence): number {
  if (confidence === 'honest') return 3;
  if (confidence === 'setting') return 2;
  return 1;
}

function ConfidenceDial({
  confidence,
  categoryName,
  tr,
}: {
  confidence: CalibrationConfidence;
  categoryName: string;
  tr: TFunction<'patterns'>;
}) {
  const t = useTheme();
  const lit = filledSteps(confidence);
  const dial: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const pipBase: ViewStyle = {
    width: t.space[4],
    height: t.space[1.5],
    borderRadius: t.radii.full,
  };
  return (
    <View
      style={dial}
      accessibilityRole="progressbar"
      accessibilityLabel={tr('honestMap.dial.accessibilityLabel', {
        category: categoryName,
        confidence: tr(CONFIDENCE_KEY[confidence]),
        lit,
      })}
    >
      {DIAL_STEPS.map((step, i) => (
        <View
          key={step}
          style={[pipBase, { backgroundColor: i < lit ? t.colors.accent : t.colors.surfaceSunken }]}
        />
      ))}
    </View>
  );
}

/** Warm, no-guilt framing from the row mix. Settled areas are celebrated; the rest
 *  are simply "still settling" — never behind, never a chore. */
function readinessLine(tr: TFunction<'patterns'>, rows: CalibrationMapRow[]): string {
  const honest = rows.filter((r) => r.confidence === 'honest').length;
  if (honest === 0) return tr('honestMap.readiness.none');
  if (honest === 1) return tr('honestMap.readiness.one');
  if (honest === rows.length) return tr('honestMap.readiness.all');
  return tr('honestMap.readiness.some', { count: honest });
}

export function HonestMap({ rows }: { rows: CalibrationMapRow[] }) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');

  const lead: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, paddingHorizontal: t.space[4], paddingTop: t.space[3] };
  const cardStyle: ViewStyle = { backgroundColor: t.colors.surface, borderRadius: t.radii.card, borderCurve: 'continuous' };
  const row: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: t.space[3],
    paddingVertical: t.space[4], paddingHorizontal: t.space[4],
    borderBottomWidth: t.borderWidth.share, borderBottomColor: t.colors.hairline,
  };
  const leftCol: ViewStyle = { flex: 1, gap: t.space[1] };
  const name: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };
  const rightCol: ViewStyle = { alignItems: 'flex-end' };
  const honest: TextStyle = { ...(type.honestNumberMd as unknown as TextStyle), color: t.colors.accent };
  const honestRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[1] };
  const unit: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const guess: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <View style={cardStyle}>
      <Text style={lead}>{readinessLine(tr, rows)}</Text>
      {rows.map((r, i) => (
        <View key={r.categoryId} style={[row, i === rows.length - 1 ? { borderBottomWidth: 0 } : null]}>
          <View style={leftCol}>
            <Text style={name} numberOfLines={1}>{r.categoryName}</Text>
            <Text style={sub}>
              {tr('honestMap.sub', { multiplier: r.multiplier.toFixed(1), confidence: tr(CONFIDENCE_KEY[r.confidence]) })}
            </Text>
          </View>
          <ConfidenceDial confidence={r.confidence} categoryName={r.categoryName} tr={tr} />
          <View style={rightCol}>
            <View style={honestRow}>
              <Text style={honest}>~{r.honestMin}</Text>
              <Text style={unit}>{tr('honestMap.unit')}</Text>
            </View>
            <Text style={guess}>{tr('honestMap.guess', { guessMin: r.guessMin })}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

