import { type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';

// Screens rendered under a navigation header must NOT re-inset the top — the
// header already clears the status bar. Pass edges={['left','right']} there to
// avoid a double top gap. `backdrop` renders full-bleed behind the padded content.
//
// `horizontalPadding` (default true) adds the standard side gutters. formSheet
// drawers pass `false`: react-native-screens' native sheet container silently drops
// the LEFT padding of a JS child (content hugged the left edge), so those screens
// take their horizontal gutters from the sheet's native `contentStyle` instead —
// which applies uniformly to scroll content AND pinned footers. See app/_layout.tsx.
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  backdrop,
  horizontalPadding = true,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  backdrop?: ReactNode;
  horizontalPadding?: boolean;
}) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={edges}>
      {backdrop}
      <View style={{ flex: 1, paddingHorizontal: horizontalPadding ? t.space[5] : 0 }}>{children}</View>
    </SafeAreaView>
  );
}
