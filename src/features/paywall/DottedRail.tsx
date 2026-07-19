import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// DottedRail — the vertical dotted connector between timeline dots/coins. RN's
// border-style dotted is unreliable for a single left border on Android, so the
// rail is a clipped column of real dots: cross-platform, identical everywhere.
//
// ABSOLUTELY positioned on purpose: a flex:1 rail inside an auto-height column
// makes Yoga size the column by the rail's CONTENT (all the dots), inflating
// every row with dead space. Absolute keeps the text column the only thing that
// drives row height; the rail just paints from under the dot to the row's end,
// clipping surplus dots. `topOffset` = the dot/coin height it hangs below.
// ──────────────────────────────────────────────────────────────────────────────

const DOT_COUNT = 24; // more than any rail needs; the overflow clips.

export function DottedRail({ topOffset }: { topOffset: number }) {
  const t = useTheme();
  const wrap: ViewStyle = {
    position: 'absolute',
    top: topOffset + t.space[1],
    bottom: t.space[1],
    left: 0,
    right: 0,
    alignItems: 'center',
    overflow: 'hidden',
    gap: t.space[1],
  };
  const dot: ViewStyle = {
    width: t.space[0.5],
    height: t.space[0.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.gapStripeHi,
  };
  return (
    <View style={wrap} pointerEvents="none">
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <View key={i} style={dot} />
      ))}
    </View>
  );
}
