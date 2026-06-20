import { useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import {
  CategoryChips,
  usePickerCategories,
} from '@/src/features/shared/CategoryChips';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// PostStopCaptureSheet — bottom action-sheet shown after stopping a quick-start
// timer. Non-blocking: it is mounted inside the timer screen's render tree (not
// a modal) so the timer stays visible behind it.
//
// IMPORTANT:
//  • Entering-ONLY animation (no `exiting` prop — Fabric SIGABRT on conditional
//    mount/unmount). The parent controls visibility by mounting/unmounting.
//  • No boxShadow (hard line on Fabric). Depth via flat hairline + scrim.
//  • Pressable = bare touch wrapper; visual on inner View.
//  • All values from useTheme() tokens.
// ──────────────────────────────────────────────────────────────────────────────

export interface PostStopCaptureSheetProps {
  /** Controlled label text (task name). */
  label: string;
  onLabelChange: (v: string) => void;
  /** Controlled selected category id. */
  category: string | null;
  onCategoryChange: (id: string) => void;
  /** Called when the user taps "Save — teaches your real pace". */
  onSave: () => void;
  /** Called when the user taps "Skip for now". */
  onSkip: () => void;
}

export function PostStopCaptureSheet({
  label,
  onLabelChange,
  category,
  onCategoryChange,
  onSave,
  onSkip,
}: PostStopCaptureSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<TextInput>(null);

  // Category picker data + frequency sort hints (same approach as AddTask).
  const categories = usePickerCategories();
  const stats = useCalibrationStore((s) => s.statsByCategory);
  // Usage count per category id — drives frequency sort in CategoryChips.
  const usage: Record<string, number> = {};
  for (const [id, stat] of Object.entries(stats)) {
    usage[id] = stat.n;
  }

  // ── styles (all tokens) ────────────────────────────────────────────────────

  /** Full-screen scrim — sits above the timer UI but below the sheet. */
  const scrimStyle: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
  };

  /** Sheet surface — attached to the bottom of the screen. */
  const sheetStyle: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderTopWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    paddingTop: t.space[2],
    paddingHorizontal: t.space[4],
    paddingBottom: insets.bottom + t.space[4],
    gap: t.space[4],
  };

  const grabberWrap: ViewStyle = {
    alignItems: 'center',
    paddingBottom: t.space[2],
  };
  const grabber: ViewStyle = {
    width: t.space[8],
    height: t.space[1],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.hairline,
  };

  const headlineStyle: TextStyle = {
    fontSize: t.fontSize.subtitle,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
    letterSpacing: t.letterSpacing.tight,
  };

  const sublineStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };

  const labelStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    letterSpacing: t.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: t.space[2],
  };

  const inputStyle: TextStyle = {
    height: t.size.control.md,
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.md,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    paddingHorizontal: t.space[3],
  };

  const skipStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  return (
    <>
      {/* Scrim — non-interactive (tapping it does nothing; user must choose Save or Skip) */}
      <View style={scrimStyle} pointerEvents="none" />

      {/* Sheet — slides up from the bottom, entering-only */}
      <Animated.View
        style={sheetStyle}
        entering={reducedMotion ? undefined : FadeInDown.duration(t.motion.sheet)}
        accessibilityViewIsModal
        accessibilityLabel="Name this task"
      >
        {/* Grab handle */}
        <View style={grabberWrap} accessible={false}>
          <View style={grabber} />
        </View>

        {/* Headline */}
        <View>
          <AppText style={headlineStyle}>What were you working on?</AppText>
          <AppText style={sublineStyle}>Takes 5 seconds · sharpens your estimates</AppText>
        </View>

        {/* Name input (optional — user can skip) */}
        <View>
          <AppText style={labelStyle}>Task name (optional)</AppText>
          <TextInput
            ref={inputRef}
            style={inputStyle}
            value={label}
            onChangeText={onLabelChange}
            placeholder="e.g. Clear inbox"
            placeholderTextColor={t.colors.inkFaint}
            returnKeyType="done"
            blurOnSubmit
            accessibilityLabel="Task name"
          />
        </View>

        {/* Category chips */}
        <View>
          <AppText style={labelStyle}>Category</AppText>
          <CategoryChips
            categories={categories}
            value={category}
            onChange={onCategoryChange}
            usage={usage}
          />
        </View>

        {/* Save CTA */}
        {/* The AppButton label is the a11y text; it already has role="button". */}
        <AppButton
          label="Save — teaches your real pace"
          variant="indigo"
          size="md"
          fullWidth
          onPress={onSave}
        />

        {/* Skip (secondary — no destructive styling; no guilt) */}
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip for now — this run won't train your estimates"
          hitSlop={8}
        >
          <View style={{ alignItems: 'center', paddingVertical: t.space[1] }}>
            <AppText style={skipStyle}>Skip for now</AppText>
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}
