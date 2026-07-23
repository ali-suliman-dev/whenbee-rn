import { Pressable, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// The "log something you finished" ghost task slot. Dashed border with a leading
// plus-coin and two-tone text. Shared by Today's empty state and the populated
// screen, so the copy can differ per surface. The whole row is the touch target
// into the retro-log modal.
export function RetroLogChip({
  firstText,
  secondText,
  onPress,
}: {
  firstText: string;
  secondText: string;
  onPress: () => void;
}) {
  const t = useTheme();

  const chip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    borderWidth: t.borderWidth.ghost,
    borderColor: t.colors.ghostBorder,
    borderStyle: 'dashed',
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
  };

  const coin: ViewStyle = {
    width: t.iconSize.lg,
    height: t.iconSize.lg,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.primaryWash,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const coinText: TextStyle = {
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.bold,
    color: t.colors.primary,
  };

  const textContainer: TextStyle = {
    flex: 1,
    ...(type.bodySm as unknown as TextStyle),
  };

  const firstTextStyle: TextStyle = {
    color: t.colors.inkSoft,
  };

  const secondTextStyle: TextStyle = {
    color: t.colors.primary,
    fontWeight: t.fontWeight.semibold,
  };

  const a11yLabel = `${firstText}${secondText}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      {({ pressed }) => (
        <View
          style={[
            chip,
            {
              opacity: pressed ? t.opacity.pressed : 1,
            },
          ]}
        >
          <View style={coin}>
            <Text style={coinText}>+</Text>
          </View>
          <Text style={textContainer}>
            <Text style={firstTextStyle}>{firstText}</Text>
            <Text style={secondTextStyle}>{secondText}</Text>
          </Text>
        </View>
      )}
    </Pressable>
  );
}
