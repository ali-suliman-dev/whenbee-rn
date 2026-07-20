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
  // The dot column is ABSOLUTE on purpose. In normal flow its 14 dots carry real
  // intrinsic height (~84dp), which made the rail column taller than the text
  // column — so the rail, not the caller's padding, dictated row height and the
  // step spacing refused to tighten (and nothing ever clipped). Absolute = zero
  // intrinsic height, so the text column drives the row and the overflow clips.
  const wrap: ViewStyle = { flex: 1, alignSelf: 'stretch', overflow: 'hidden' };
  const column: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
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
      <View style={column}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <View key={i} style={dot} />
        ))}
      </View>
    </View>
  );
}
