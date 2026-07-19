import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// DottedRail — the vertical dotted connector between timeline dots/coins. RN's
// border-style dotted is unreliable for a single left border on Android, so the
// rail is a clipped column of real dots: cross-platform, identical everywhere.
// ──────────────────────────────────────────────────────────────────────────────

const DOT_COUNT = 14; // more than any rail needs; the overflow clips.

export function DottedRail() {
  const t = useTheme();
  const wrap: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    overflow: 'hidden',
    gap: t.space[1],
    paddingVertical: t.space[0.5],
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
