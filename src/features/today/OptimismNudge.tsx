import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// OptimismNudge — the scarce amber over-run cue on the focus card.
//
// amberSoft pill + warning glyph + words (never color-only, never red, no guilt).
// Shown ONLY when there is personal evidence AND the honest number beats the
// guess; suppressed on prior basis. Caller owns that gating.
// ──────────────────────────────────────────────────────────────────────────────

export function OptimismNudge({ honestMin }: { honestMin: number }) {
  const t = useTheme();

  const pill: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    alignSelf: 'flex-start',
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
  };

  const copy: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    flexShrink: 1,
  };

  return (
    <View
      style={pill}
      accessibilityRole="text"
      accessibilityLabel={`You're being optimistic again — block ${honestMin} minutes.`}
    >
      <Ionicons name="warning-outline" size={15} color={t.colors.amberText} />
      <Text style={copy}>You&apos;re being optimistic again — block {honestMin}.</Text>
    </View>
  );
}
