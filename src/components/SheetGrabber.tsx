import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// SheetGrabber — the handle at the top of a seamless formSheet (the native
// header bar is gone). A static, centered rounded pill — the clean iOS-native
// look. No motion: the grab affordance reads from shape alone.
// ──────────────────────────────────────────────────────────────────────────────

const HANDLE_W = 40;
const HANDLE_H = 5;

export function SheetGrabber() {
  const t = useTheme();

  const handle: ViewStyle = {
    width: HANDLE_W,
    height: HANDLE_H,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.inkSoft,
    opacity: 0.35,
  };

  return (
    <View style={{ alignItems: 'center' }} pointerEvents="none">
      <View style={handle} />
    </View>
  );
}
