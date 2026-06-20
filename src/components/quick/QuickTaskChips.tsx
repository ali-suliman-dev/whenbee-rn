import { Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useQuickTasks, type QuickTaskChip } from '@/src/features/quick-tasks/useQuickTasks';

// ─────────────────────────────────────────────────────────────────────────────
// QuickTaskChips — "Tap to start again" row on Today
//
// Renders nothing when chips.length === 0 (no label, no empty space).
// Data comes from useQuickTasks() (Task 2): ≤4 chips, already thresholded.
//
// Each chip:
//   • surface fill + 1px hairline border (chip borderWidth token) + radii.full
//   • left: small play disc — primarySoft bg + primaryEdge play glyph
//   • right: title (Jakarta-Bold 14pt) + sub-line "~{honestMin}m honest" (muted)
//   • Pressable is a bare touch wrapper; visual + press-scale live on inner View
//   • haptics.light() → startQuickTask(chip)
//
// Motion: FadeInDown entry only (motion.base). No exiting animation (Fabric).
// ─────────────────────────────────────────────────────────────────────────────

function QuickChip({
  chip,
  onPress,
  index,
}: {
  chip: QuickTaskChip;
  onPress: (chip: QuickTaskChip) => void;
  index: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const pressScale = useSharedValue(1);

  function handlePressIn() {
    if (reducedMotion) return;
    pressScale.set(withTiming(t.scale.pressIn, { duration: t.motion.press }));
  }
  function handlePressOut() {
    if (reducedMotion) return;
    pressScale.set(withTiming(1, { duration: t.motion.fast }));
  }
  function handlePress() {
    haptics.light();
    onPress(chip);
  }

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.get() }],
  }));

  const chipSurface: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.quick.chipGap,
    borderRadius: t.radii.full,
    borderCurve: 'continuous' as ViewStyle['borderCurve'],
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.quick.chipPadH,
    paddingVertical: t.quick.chipPadV,
    // Flat surface — no boxShadow (hard line on Fabric)
  };

  const discStyle: ViewStyle = {
    width: t.quick.disc,
    height: t.quick.disc,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const titleStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.ink,
  };

  const estimateStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: 1,
  };

  const enterDelay = index * t.motion.stagger;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Start ${chip.label}, about ${chip.honestMin} minutes`}
    >
      <Animated.View
        style={pressStyle}
        entering={reducedMotion ? undefined : FadeInDown.duration(t.motion.base).delay(enterDelay)}
      >
        <View style={chipSurface}>
          <View style={discStyle}>
            <Ionicons
              name="play"
              size={t.iconSize.sm - 2}
              color={t.colors.primaryEdge}
            />
          </View>
          <View>
            <Text style={titleStyle} numberOfLines={1}>
              {chip.label}
            </Text>
            <Text style={estimateStyle}>{`~${chip.honestMin}m honest`}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function QuickTaskChips() {
  const t = useTheme();
  const { chips, startQuickTask } = useQuickTasks();

  if (chips.length === 0) return null;

  const sectionLabel: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[1],
  };

  const rowContent: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.quick.rowGap,
    paddingRight: t.space[4],
  };

  return (
    <View style={{ gap: t.space[2] }}>
      <Text style={sectionLabel}>Tap to start again</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={rowContent}
      >
        {chips.map((chip, index) => (
          <QuickChip
            key={chip.id}
            chip={chip}
            onPress={startQuickTask}
            index={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}
