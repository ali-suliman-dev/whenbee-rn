import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { SheetScrollView } from '@/src/components/SheetScrollView';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useFeedback } from '@/src/features/feedback/useFeedback';
import { WhatsNewEmpty } from '@/src/features/feedback/WhatsNewEmpty';
import type { ChangelogEntry } from '@/src/features/feedback/types';

// ──────────────────────────────────────────────────────────────────────────────
// What's new (formSheet) — read-only, founder-published changelog. Loads on
// mount, marks itself seen on unmount so the Settings unread dot clears once
// the user has actually looked.
// ──────────────────────────────────────────────────────────────────────────────

export default function WhatsNew() {
  const t = useTheme();
  const { t: tr } = useTranslation('feedback');
  const insets = useSafeAreaInsets();
  const { changelog, loading, loadChangelog, markChangelogSeen } = useFeedback();

  useEffect(() => {
    void loadChangelog();
  }, [loadChangelog]);

  // Mark seen when leaving the screen — not on load, so the dot stays visible
  // for the moment the user is actually looking at the list.
  useEffect(() => () => markChangelogSeen(), [markChangelogSeen]);

  const empty = changelog.length === 0 && !loading;

  return (
    // The formSheet's native contentStyle (see src/app/_layout.tsx) supplies the
    // side gutters — this screen adds no paddingHorizontal of its own.
    <Screen horizontalPadding={false} edges={['left', 'right']}>
      {/* Fixed drag header — OUTSIDE the ScrollView so it is NOT the sheet's
          scrolling child. On Android the sheet (BottomSheetBehavior) only drags
          from touches outside that child, so grabber + heading are what makes the
          top of the sheet a real drag-to-dismiss zone. See retro.tsx. */}
      <View style={{ paddingTop: t.space[5], paddingBottom: t.space[3] }}>
        <SheetGrabber />
        <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink }}>
          {tr('whatsNew.title')}
        </AppText>
      </View>

      {empty ? (
        // The empty state never scrolls, so it stays outside the scroll child —
        // the whole surface drags.
        <View style={{ flex: 1, paddingBottom: insets.bottom + t.space[6] }}>
          <WhatsNewEmpty />
        </View>
      ) : (
        // flexShrink (not flex:1): with a few entries the list is only as tall as
        // its cards, so everything below stays plain sheet background — drag zone,
        // not scroll child. It shrinks and scrolls only once entries overflow.
        <SheetScrollView
          style={{ flexShrink: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + t.space[6],
            gap: t.space[3],
          }}
        >
          {changelog.map((e) => (
            <ChangelogCard key={e.id} entry={e} />
          ))}
        </SheetScrollView>
      )}
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
