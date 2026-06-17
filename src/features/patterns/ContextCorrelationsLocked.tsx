import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// ContextCorrelationsLocked (S4) — non-Pro teaser for "what moves your accuracy".
// Names what the optional energy notes can reveal, then offers Pro. Tapping opens
// the paywall with the steals_your_time trigger (shared Pro-Patterns surface).
// ──────────────────────────────────────────────────────────────────────────────

const HEADLINE = 'Does your energy move your accuracy?';
const DETAIL =
  'When you note your energy after a session, that is a clue. Pro reads it back: whether low-energy days throw your estimates off, so you know when to leave more buffer.';

export function ContextCorrelationsLocked() {
  const t = useTheme();

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const ctaRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const cta: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };
  const block: ViewStyle = { gap: t.space[1.5] };

  const openPaywall = () => {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'steals_your_time' } });
  };

  return (
    <Pressable
      onPress={openPaywall}
      accessibilityRole="button"
      accessibilityLabel="Unlock what moves your accuracy with Pro"
    >
      <Card tone="flat" style={{ gap: t.space[3] }}>
        <View style={eyebrowRow}>
          <Ionicons name="battery-half-outline" size={t.iconSize.sm} color={t.colors.primary} />
          <Text style={eyebrow} numberOfLines={1}>
            WHAT MOVES YOUR ACCURACY
          </Text>
        </View>
        <View style={block}>
          <Text style={headline}>{HEADLINE}</Text>
          <Text style={detail}>{DETAIL}</Text>
        </View>
        <View style={ctaRow}>
          <Text style={cta}>Unlock with Pro</Text>
          <Ionicons name="arrow-forward" size={t.iconSize.xs} color={t.colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}
