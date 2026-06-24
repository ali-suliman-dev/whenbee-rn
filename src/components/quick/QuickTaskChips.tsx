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
// Each chip is a SLIM single-line pill — one line, low footprint:
//   • surface fill + 1px hairline border (chip borderWidth token) + radii.full
//   • inline: tiny play glyph · name (captionBold 12pt) · muted honest time
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

  // Slim single-line pill — everything sits inline on one row.
  const chipSurface: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    borderRadius: t.radii.full,
    borderCurve: 'continuous' as ViewStyle['borderCurve'],
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1.5],
    // Flat surface — no boxShadow (hard line on Fabric)
  };

  const titleStyle: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.ink,
  };

  const timeStyle: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const unitStyle: TextStyle = { fontSize: t.fontSize['2xs'], color: t.colors.inkSoft };

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
          <Ionicons name="play" size={10} color={t.colors.primary} />
          <Text style={titleStyle} numberOfLines={1}>
            {chip.label}
          </Text>
          <Text style={timeStyle}>
            {chip.honestMin}
            <Text style={unitStyle}>m</Text>
          </Text>
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
