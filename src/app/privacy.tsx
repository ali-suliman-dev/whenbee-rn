import { View, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { PrivacyGlyph, type PrivacyGlyphKind } from '@/src/components/icons/PrivacyGlyph';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

const POINTS: { icon: PrivacyGlyphKind; title: string; body: string }[] = [
  {
    icon: 'phone',
    title: 'It stays on this phone',
    body: 'Your tasks, the times you log, and the multipliers Whenbee works out from them live in a database on your device. They are never uploaded.',
  },
  {
    icon: 'person',
    title: 'No account, no email',
    body: "You didn't sign up for anything, so there's no profile of you on a server somewhere. Nothing ties your data to your name.",
  },
  {
    icon: 'bug',
    title: 'Anonymous crash and usage counts',
    body: 'To find bugs and see which screens get used, Whenbee sends anonymous events — taps and crashes, never your task names, times, or categories.',
  },
  {
    icon: 'calendar',
    title: 'Your calendar, read on request',
    body: 'Honest-Day reads your calendar only when you open it, and writes a padded block back only after you confirm. Nothing is sent anywhere.',
  },
];

export default function Privacy() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

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
        <AppText style={lead}>
          Exactly what Whenbee keeps on your phone, and what it never sends anywhere.
        </AppText>

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
