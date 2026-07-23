import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PatternsEmpty — what a brand-new (or thin-data) user sees: calm, encouraging,
// never a wall of blank cards and never a scold. Your insights are waiting to be
// earned, not missing.
// ──────────────────────────────────────────────────────────────────────────────

export function PatternsEmpty({ archetypeShown = false }: { archetypeShown?: boolean }) {
  const t = useTheme();

  // With the provisional archetype card above, this block is a footnote, not the
  // whole screen — it hugs the card and stops promising the personality reveal.
  const wrap: ViewStyle = {
    alignItems: 'center',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
    paddingTop: archetypeShown ? t.space[6] : t.space[16],
  };
  const disc: ViewStyle = {
    width: t.size.control.lg,
    height: t.size.control.lg,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const title: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink, textAlign: 'center' };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft, textAlign: 'center' };

  if (archetypeShown) {
    return (
      <View style={wrap}>
        <Text style={body}>
          Time a few tasks and this fills in with your sharpest category and the surprises worth
          noticing.
        </Text>
      </View>
    );
  }

  return (
    <View style={wrap}>
      <View style={disc}>
        <Ionicons name="analytics-outline" size={t.iconSize.lg} color={t.colors.primary} />
      </View>
      <Text style={title}>Your patterns are on the way</Text>
      <Text style={body}>
        Time a few tasks and this is where you&apos;ll meet your time personality, your sharpest
        category, and the surprises worth noticing.
      </Text>
    </View>
  );
}
