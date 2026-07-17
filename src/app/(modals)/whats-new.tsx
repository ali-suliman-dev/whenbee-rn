import { useEffect } from 'react';
import { View, ScrollView, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useFeedback } from '@/src/features/feedback/useFeedback';
import type { ChangelogEntry } from '@/src/features/feedback/types';

// ──────────────────────────────────────────────────────────────────────────────
// What's new (formSheet) — read-only, founder-published changelog. Loads on
// mount, marks itself seen on unmount so the Settings unread dot clears once
// the user has actually looked.
// ──────────────────────────────────────────────────────────────────────────────

export default function WhatsNew() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { changelog, loading, loadChangelog, markChangelogSeen } = useFeedback();

  useEffect(() => {
    void loadChangelog();
  }, [loadChangelog]);

  // Mark seen when leaving the screen — not on load, so the dot stays visible
  // for the moment the user is actually looking at the list.
  useEffect(() => () => markChangelogSeen(), [markChangelogSeen]);

  return (
    // The formSheet's native contentStyle (see src/app/_layout.tsx) supplies the
    // side gutters — this screen adds no paddingHorizontal of its own.
    <Screen horizontalPadding={false} edges={['left', 'right']}>
      <SheetGrabber />
      <ScrollView contentContainerStyle={{ paddingTop: t.space[5], paddingBottom: insets.bottom + t.space[6], gap: t.space[3] }}>
        <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink, marginBottom: t.space[2] }}>
          What&apos;s new
        </AppText>
        {changelog.length === 0 && !loading ? (
          <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkSoft }}>Nothing new yet.</AppText>
        ) : (
          changelog.map((e) => <ChangelogCard key={e.id} entry={e} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const t = useTheme();
  const shipped = entry.status === 'shipped';
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radii.card,
        borderCurve: 'continuous',
        padding: t.space[4],
        gap: t.space[2],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
        <View
          style={{
            backgroundColor: shipped ? t.colors.accentChip : t.colors.primaryChip,
            borderRadius: t.radii.full,
            paddingHorizontal: t.space[2],
            paddingVertical: t.space[0.5],
          }}
        >
          <AppText style={{ ...(type.eyebrowSm as TextStyle), color: shipped ? t.colors.amberText : t.colors.primary }}>
            {shipped ? 'Shipped' : 'Planned'}
          </AppText>
        </View>
      </View>
      <AppText style={{ ...(type.bodySmBold as TextStyle), color: t.colors.ink }}>{entry.title}</AppText>
      <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkSoft }}>{entry.body}</AppText>
    </View>
  );
}
