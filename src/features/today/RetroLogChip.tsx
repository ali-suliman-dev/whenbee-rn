import { Pressable, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// The "log something you finished" chip. Shared by Today's empty state and the
// populated screen, so the copy can differ per surface while the styling stays one
// source. The whole row is the touch target into the retro-log modal.
export function RetroLogChip({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();

  const chip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    alignSelf: 'stretch',
    // Quiet secondary affordance — standard surface keeps it light and part of the
    // page rather than recessed below the focal data cards above. Differentiate by
    // fill, not an edge (no border, matching the rest of the cards).
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
  };
  const text: TextStyle = { ...(type.bodySm as unknown as TextStyle), fontSize: t.fontSize.sm, color: t.colors.ink, flex: 1 };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={chip}
    >
      <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.inkSoft} />
      <Text style={text}>{label}</Text>
      <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
    </Pressable>
  );
}
