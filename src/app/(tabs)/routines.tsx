import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { RoutinesScreen } from '@/src/features/routines/RoutinesScreen';

// ──────────────────────────────────────────────────────────────────────────────
// Routines tab — thin route. Renders RoutinesScreen directly.
// The Start-By build/run flow (BuildView / RunView) was retired from the tab
// in Phase 6 (C2) — per-day planning now lives in the Phase-4 Timeline.
// Pro-gating is RoutinesScreen's responsibility; nothing here conditionally
// branches on plan phase or segment state.
// ──────────────────────────────────────────────────────────────────────────────

export default function RoutinesRoute() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, paddingHorizontal: t.space[5] }}>
        <RoutinesScreen />
      </View>
    </SafeAreaView>
  );
}
