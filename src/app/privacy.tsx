import { View, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { PrivacyGlyph, type PrivacyGlyphKind } from '@/src/components/icons/PrivacyGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

export default function Privacy() {
  const t = useTheme();
  const { t: tr } = useTranslation('legal');
  const insets = useSafeAreaInsets();

  const POINTS: { icon: PrivacyGlyphKind; title: string; body: string }[] = [
    { icon: 'phone', title: tr('points.onDevice.title'), body: tr('points.onDevice.body') },
    { icon: 'person', title: tr('points.noAccount.title'), body: tr('points.noAccount.body') },
    { icon: 'bug', title: tr('points.analytics.title'), body: tr('points.analytics.body') },
    { icon: 'calendar', title: tr('points.calendar.title'), body: tr('points.calendar.body') },
  ];

  const lead: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const card: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const title: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          gap: t.space[3],
          paddingTop: t.space[4],
          paddingBottom: insets.bottom + t.space[6],
        }}
      >
        <AppText style={lead}>{tr('lead')}</AppText>

        {POINTS.map((p, i) => (
          // Cards stay static — only the glyph animates (a staggered one-shot mount
          // flourish, driven inside PrivacyGlyph).
          <View key={p.title} style={card}>
            <PrivacyGlyph kind={p.icon} index={i} size={t.iconSize.lg} />
            <View style={{ flex: 1, gap: t.space[1] }}>
              <AppText style={title}>{p.title}</AppText>
              <AppText style={body}>{p.body}</AppText>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
