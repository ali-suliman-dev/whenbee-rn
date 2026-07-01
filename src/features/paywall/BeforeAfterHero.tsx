import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// BeforeAfterHero — the one image that earns the upgrade, as two day-columns
// (the prototype's before/after, not abstract bars):
//
//   YOUR PLAN              HONEST DAY
//   ▓▓▓▓                   ███          your real time  (indigo)
//   ▓▓▓                    ▬▬           the buffer      (amber)
//   ▓▓▓▓▓ (faded — spill)  ███
//   ▓▓▓▓  (faded — spill)  ▬
//   Crashes 5:00.          Ends 7:10.
//   Runs over.             It fits.
//
// Planned packs the tasks edge-to-edge and the last two SPILL past the day (faded
// neutral blocks — the brand never shames, so no red). Honest interleaves your
// real-time blocks (indigo) with the buffer Whenbee pads in (amber), and the whole
// day lands before close. A legend names the two colors so the amber reads as the
// Pro feature (padding), not decoration.
// ──────────────────────────────────────────────────────────────────────────────

// Relative widths (fractions) of each stacked block.
const PLAN_BLOCKS = [0.92, 0.74] as const; // the optimistic tasks that fit
const PLAN_SPILL = [1, 0.88] as const; // the work that never fit — bleeds past the day
const HONEST_REAL = [0.9, 0.72] as const; // your real task time (indigo)
const HONEST_PAD = [0.34, 0.26] as const; // the buffer Whenbee adds (amber)

export function BeforeAfterHero() {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');

  const colLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const colLabelAfter: TextStyle = { ...colLabel, color: t.colors.amberText };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const noteAfter: TextStyle = { ...note, color: t.colors.amberText, fontFamily: 'Jakarta-Bold' };
  const legendText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const columns: ViewStyle = { flexDirection: 'row', gap: t.space[3] };
  const column: ViewStyle = {
    flex: 1,
    gap: t.space[2],
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[3],
  };
  const stack: ViewStyle = { gap: t.space[1.5] };
  const slot: ViewStyle = { height: t.space[3], borderRadius: t.radii.sm, borderCurve: 'continuous' };
  const legend: ViewStyle = { flexDirection: 'row', gap: t.space[4], marginTop: t.space[1] };
  const legendItem: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const swatch: ViewStyle = { width: t.space[3], height: t.space[2], borderRadius: t.radii.sm };

  return (
    <Card tone="raised" style={{ gap: t.space[3] }}>
      <View style={columns}>
        {/* Your plan — packs tight, then spills past the day. */}
        <View style={column}>
          <Text style={colLabel}>{tr('beforeAfter.planLabel')}</Text>
          <View style={stack}>
            {PLAN_BLOCKS.map((w, i) => (
              <View key={`p${i}`} style={[slot, { width: `${w * 100}%`, backgroundColor: t.colors.inkFaint }]} />
            ))}
            {PLAN_SPILL.map((w, i) => (
              <View
                key={`s${i}`}
                style={[slot, { width: `${w * 100}%`, backgroundColor: t.colors.inkFaint, opacity: t.opacity.disabled }]}
              />
            ))}
          </View>
          <Text style={note}>{tr('beforeAfter.planNote')}</Text>
        </View>

        {/* Honest day — real time (indigo) + the buffer Whenbee adds (amber). */}
        <View style={column}>
          <Text style={colLabelAfter}>{tr('beforeAfter.honestLabel')}</Text>
          <View style={stack}>
            <View style={[slot, { width: `${HONEST_REAL[0] * 100}%`, backgroundColor: t.colors.primary }]} />
            <View style={[slot, { width: `${HONEST_PAD[0] * 100}%`, backgroundColor: t.colors.accent }]} />
            <View style={[slot, { width: `${HONEST_REAL[1] * 100}%`, backgroundColor: t.colors.primary }]} />
            <View style={[slot, { width: `${HONEST_PAD[1] * 100}%`, backgroundColor: t.colors.accent }]} />
          </View>
          <Text style={noteAfter}>{tr('beforeAfter.honestNote')}</Text>
        </View>
      </View>

      <View style={legend}>
        <View style={legendItem}>
          <View style={[swatch, { backgroundColor: t.colors.primary }]} />
          <Text style={legendText}>{tr('beforeAfter.legendReal')}</Text>
        </View>
        <View style={legendItem}>
          <View style={[swatch, { backgroundColor: t.colors.accent }]} />
          <Text style={legendText}>{tr('beforeAfter.legendBuffer')}</Text>
        </View>
      </View>
    </Card>
  );
}
