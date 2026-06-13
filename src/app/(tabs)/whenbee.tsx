import { ScrollView, View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { WhenbeeHub } from '@/src/features/whenbee/WhenbeeHub';

// ──────────────────────────────────────────────────────────────────────────────
// Whenbee tab — thin route. The companion hub (avatar, honeycomb, tier trail,
// Reclaim hero, blind-spot nudge, category drill-down, day-honest CTA) lives in
// the WhenbeeHub feature; this screen only provides the Screen + scroll shell.
// ──────────────────────────────────────────────────────────────────────────────

export default function Whenbee() {
  const t = useTheme();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header sits ABOVE the hero sunburst (zIndex) so rotating rays never
            cover the title/subtitle — the illustration is the backmost layer. */}
        <View style={{ zIndex: 2 }}>
          <ScreenHeader title="Whenbee" subtitle="Your honeycomb and the patterns behind it." />
        </View>
        <WhenbeeHub />
      </ScrollView>
    </Screen>
  );
}
