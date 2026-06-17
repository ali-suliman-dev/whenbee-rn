import { type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';

// Screens rendered under a navigation header must NOT re-inset the top — the
// header already clears the status bar. Pass edges={['left','right']} there to
// avoid a double top gap. `backdrop` renders full-bleed behind the padded content.
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  backdrop,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  backdrop?: ReactNode;
}) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={edges}>
      {backdrop}
      <View style={{ flex: 1, paddingHorizontal: t.space[5] }}>{children}</View>
    </SafeAreaView>
  );
}
