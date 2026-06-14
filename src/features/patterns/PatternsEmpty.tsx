import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PatternsEmpty — what a brand-new (or thin-data) user sees: calm, encouraging,
// never a wall of blank cards and never a scold. Your insights are waiting to be
// earned, not missing.
// ──────────────────────────────────────────────────────────────────────────────

export function PatternsEmpty() {
  const t = useTheme();

  const wrap: ViewStyle = { alignItems: 'center', gap: t.space[3], paddingHorizontal: t.space[4], paddingTop: t.space[16] };
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

  return (
    <View style={wrap}>
      <View style={disc}>
        <Ionicons name="sparkles-outline" size={t.iconSize.lg} color={t.colors.primary} />
      </View>
      <Text style={title}>Your patterns are on the way</Text>
      <Text style={body}>
        Time a few tasks and this is where you&apos;ll meet your time personality, your sharpest
        category, and the surprises worth noticing.
      </Text>
    </View>
  );
}
