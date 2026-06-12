import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { BlindSpot } from './useWhenbeeHub';

// ──────────────────────────────────────────────────────────────────────────────
// BlindSpotCard — a kind "let's calibrate this next" nudge, never a scold. The
// internal name is "blind spot"; the user-facing copy is an invitation. It points
// at the lowest-sharpness tracked category and offers a one-tap drill into its
// Tune screen. Flat card (hairline border) — this is a quiet suggestion, not the
// hero, so it stays under the focal Reclaim card in the visual hierarchy.
//
//   WHENBEE'S STILL LEARNING THIS ONE
//   Deep Work
//   A few more honest logs here and its number gets sharper.   →
//
// Rendered only when a blind spot exists (the parent gates on vm.blindSpot).
// ──────────────────────────────────────────────────────────────────────────────

export function BlindSpotCard({ blindSpot }: { blindSpot: BlindSpot }) {
  const t = useTheme();

  function open() {
    router.push({ pathname: '/category/[category]', params: { category: blindSpot.categoryId } });
  }

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const name: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };

  const footerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Calibrate ${blindSpot.name} next`}
    >
      <Card style={{ gap: t.space[2] }}>
        <Text style={eyebrow}>WHENBEE&apos;S STILL LEARNING THIS ONE</Text>
        <Text style={name}>{blindSpot.name}</Text>
        <View style={footerRow}>
          <Text style={body}>A few more honest logs here and its number gets sharper.</Text>
          <Ionicons name="arrow-forward" size={20} color={t.colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}
