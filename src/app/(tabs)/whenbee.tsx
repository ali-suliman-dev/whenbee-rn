import { ScrollView } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { useTheme } from '@/src/theme/useTheme';
import { WhenbeeHub } from '@/src/features/whenbee/WhenbeeHub';

// ──────────────────────────────────────────────────────────────────────────────
// Whenbee tab — thin route shell only. ScreenHeader now lives inside WhenbeeHub
// so the subtitle can be context-aware (empty state vs. populated). No zIndex
// wrapper needed — RayBurst is removed.
// ──────────────────────────────────────────────────────────────────────────────

export default function Whenbee() {
  const t = useTheme();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        <WhenbeeHub />
      </ScrollView>
    </Screen>
  );
}
