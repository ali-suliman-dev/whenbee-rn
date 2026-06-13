import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// BeforeAfterHero — the one image that earns the upgrade: the same four tasks,
// planned vs honest. Planned packs them edge-to-edge and the day "ends" at 5:00 —
// except the work spills past it. Honest spaces them with your real buffers, so
// the day actually closes at 7:10.
//
// Two stacked mini day-strips (not red/amber alarm blocks — the brand never
// shames). Planned uses neutral ink bars that overshoot the 5pm line; Honest uses
// calm amber (the optimism/honey accent) bars that all land before 7:10. The
// contrast is the spill, not a color scare.
//
//   PLANNED          crashes 5:00
//   ▓▓▓▓ ▓▓▓ ▓▓▓▓▓ ▓▓▓▓···  (overshoots the line)
//   HONEST           ends 7:10 · fits
//   ▒▒▒  ▒▒  ▒▒▒  ▒▒        (each lands inside)
// ──────────────────────────────────────────────────────────────────────────────

// Relative widths of four blocks on each strip (flex weights). Planned blocks are
// the optimistic guesses; honest blocks are the same tasks at their real length,
// so the row is fuller and the last block is pushed off the edge on Planned only.
const PLANNED_BLOCKS = [3, 2, 4, 3] as const;
const HONEST_BLOCKS = [4, 3, 5, 4] as const;

export function BeforeAfterHero() {
  const t = useTheme();

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const result: TextStyle = { ...(type.caption as unknown as TextStyle) };

  const headRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const strip: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[1],
    height: t.space[4],
    alignItems: 'stretch',
  };
  const blockBase: ViewStyle = {
    borderRadius: t.radii.sm,
    borderCurve: 'continuous',
  };

  return (
    <Card tone="raised" style={{ gap: t.space[4] }}>
      {/* Planned — the optimistic stack that overruns its own deadline. */}
      <View style={{ gap: t.space[2] }}>
        <View style={headRow}>
          <Text style={eyebrow}>PLANNED</Text>
          <Text style={[result, { color: t.colors.inkSoft }]}>crashes 5:00</Text>
        </View>
        <View style={strip}>
          {PLANNED_BLOCKS.map((w, i) => (
            <View
              key={i}
              style={[blockBase, { flex: w, backgroundColor: t.colors.surfaceSunken }]}
            />
          ))}
          {/* The spill: the work that never fit, bleeding past the day's edge. */}
          <View
            style={[
              blockBase,
              {
                flex: 2,
                backgroundColor: t.colors.surfaceSunken,
                opacity: t.opacity.disabled,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
              },
            ]}
          />
        </View>
      </View>

      {/* Honest — the same day, spaced to your real numbers, lands before close. */}
      <View style={{ gap: t.space[2] }}>
        <View style={headRow}>
          <Text style={eyebrow}>HONEST</Text>
          <Text style={[result, { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' }]}>
            ends 7:10 · fits
          </Text>
        </View>
        <View style={strip}>
          {HONEST_BLOCKS.map((w, i) => (
            <View key={i} style={[blockBase, { flex: w, backgroundColor: t.colors.accent }]} />
          ))}
        </View>
      </View>
    </Card>
  );
}
