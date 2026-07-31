import { Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// ProHonestWeekLink — the Pro counterpart to ProHonestWeekTease on the category
// screen. Where free users get the blurred upsell, Pro users get a quiet, always-
// available entry into the weekly recap: an amber envelope + label + chevron.
// Same slim row shape as the "quiet" recap row on Patterns, so it reads as the
// same ritual, not a new surface.
// ──────────────────────────────────────────────────────────────────────────────

export function ProHonestWeekLink() {
  const t = useTheme();

  function open() {
    analytics.capture('honest_week_open', { surface: 'category_detail' });
    router.push({ pathname: '/(modals)/review', params: { source: 'category' } });
  }

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const label: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink, flex: 1 };

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Open your Honest Week">
      <Card tone="flat" style={row}>
        <Ionicons name="mail-unread-outline" size={t.iconSize.md} color={t.colors.accent} />
        <Text style={label}>Your Honest Week</Text>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </Card>
    </Pressable>
  );
}
