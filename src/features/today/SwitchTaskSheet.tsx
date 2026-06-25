import { useEffect } from 'react';
import { Modal, Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';

export interface SwitchTaskSheetProps {
  visible: boolean;
  /** Label of the currently running task — the one that won't log. */
  leavingLabel: string;
  /** Label of the task the user tapped — the one about to start. */
  startingLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SwitchTaskSheet({
  visible,
  leavingLabel,
  startingLabel,
  onConfirm,
  onCancel,
}: SwitchTaskSheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      progress.set(visible ? 1 : 0);
      return;
    }
    // Entrance: ease-out decelerate (no spring/overshoot on content — CLAUDE.md rule).
    // Exit: fast timing (t.motion.fast) — exits should feel snappy.
    progress.set(
      visible
        ? withTiming(1, { duration: t.motion.base, easing: Easing.out(Easing.cubic) })
        : withTiming(0, { duration: t.motion.fast }),
    );
  }, [visible, reduced, progress, t.motion.fast, t.motion.base]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 40 }],
  }));

  const sheet: ViewStyle = {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[5],
    paddingTop: t.space[5],
    paddingBottom: Math.max(insets.bottom, t.space[5]),
    gap: t.space[6],
  };

  const heading: TextStyle = {
    fontSize: t.fontSize.title,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
    letterSpacing: t.letterSpacing.tight,
  };

  const body: TextStyle = {
    fontSize: t.fontSize.base,
    color: t.colors.inkSoft,
    lineHeight: t.fontSize.base * t.lineHeight.relaxed,
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.scrim },
            scrimStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} accessibilityLabel="Dismiss" onPress={onCancel} />
        </Animated.View>

        <Animated.View style={[sheet, sheetStyle]}>
          <View style={{ gap: t.space[2] }}>
            <AppText variant="title" style={heading}>Switch tasks?</AppText>
            <AppText variant="body" style={body}>
              <AppText variant="body" style={{ color: t.colors.ink, fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'] }}>
                {leavingLabel}
              </AppText>
              {" won't log. No guilt. "}
              <AppText variant="body" style={{ color: t.colors.ink, fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'] }}>
                {startingLabel}
              </AppText>
              {" starts fresh."}
            </AppText>
          </View>

          <View style={{ gap: t.space[2] }}>
            <AppButton label="Yes, switch" variant="amber" fullWidth onPress={onConfirm} />
            <AppButton label="Keep going" variant="ghost" fullWidth onPress={onCancel} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
