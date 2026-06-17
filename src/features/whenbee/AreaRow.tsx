import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// One merged row per tracked category: name · inline honey bar (sharpness) ·
// learned multiplier · chevron → the category page. Replaces both the separate
// honeycomb grid and the old "in the background" rows (one surface, not two).
export function AreaRow({
  name,
  multiplier,
  sharpness,
  onPress,
}: {
  name: string;
  multiplier?: number;
  sharpness: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const fill = Math.max(0, Math.min(100, sharpness));

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.md,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const nameText: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, minWidth: 66 };
  const track: ViewStyle = {
    flex: 1,
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const barFill: ViewStyle = { width: `${fill}%`, height: '100%', borderRadius: t.radii.full, backgroundColor: t.colors.accent };
  const multText: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.md,
    color: t.colors.primary,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  };

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name} insights`}>
      <View style={row}>
        <Text style={nameText}>{name}</Text>
        <View style={track}>
          <View style={barFill} />
        </View>
        <Text style={multText}>{multiplier !== undefined ? `${multiplier.toFixed(1)}×` : '—'}</Text>
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      </View>
    </Pressable>
  );
}
