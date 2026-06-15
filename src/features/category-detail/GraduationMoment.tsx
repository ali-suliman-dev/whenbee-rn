import { useEffect } from 'react';
import { Modal, View, Pressable, TextInput, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';

// ──────────────────────────────────────────────────────────────────────────────
// GraduationMoment — the one-time reward when a category first earns 'honest'.
//
// Fires exactly once per category, ever (the hook + kv ledger guarantee the gate).
// On mount: one success haptic, then a count-up that climbs from 0 to the honest
// number and settles. The count only ever goes UP — no guilt, no down-tick. The
// card pops in with a gentle joy spring (surprise → joy). Reduce-motion shows the
// final number immediately with no travel. Tap anywhere (or the button) to dismiss.
// ──────────────────────────────────────────────────────────────────────────────

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function GraduationMoment({
  honestMinutes,
  onDone,
}: {
  honestMinutes: number;
  onDone: () => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // count drives the climbing integer; appear drives the card pop-in.
  const count = useSharedValue(reducedMotion ? honestMinutes : 0);
  const appear = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    // Success-only: this is a win, never a warning. Fire once on mount.
    haptics.success();
    if (reducedMotion) return;
    // Dramatic reveal: decelerate into the landing number (joy, not a tick read).
    appear.set(withSpring(1, t.motion.spring));
    count.set(withTiming(honestMinutes, { duration: t.motion.draw, easing: t.motion.easing.standard }));
  }, [reducedMotion, honestMinutes, appear, count, t.motion.spring, t.motion.draw, t.motion.easing.standard]);

  // Round in the worklet so the climbing label only ever shows whole minutes.
  const numberProps = useAnimatedProps(
    () =>
      ({ text: `~${Math.round(count.get())}` } as unknown as Partial<
        import('react-native').TextInputProps
      >),
  );

  const cardAnim = useAnimatedStyle(() => {
    const a = appear.get();
    return { opacity: a, transform: [{ scale: 0.9 + a * 0.1 }] };
  });

  const scrim: ViewStyle = {
    flex: 1,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.space[6],
  };
  const card: ViewStyle = {
    width: '100%',
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    padding: t.space[6],
    gap: t.space[4],
    alignItems: 'center',
  };
  const coin: ViewStyle = {
    width: t.space[12],
    height: t.space[12],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const numberStyle: TextStyle = {
    ...(type.honestNumberXl as unknown as TextStyle),
    color: t.colors.primary,
    padding: 0,
    textAlign: 'center',
  };
  const title: TextStyle = {
    ...(type.title as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const sub: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable
        style={scrim}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Animated.View style={[card, cardAnim]} accessibilityViewIsModal>
          <View style={coin}>
            <Ionicons name="checkmark-circle" size={t.iconSize.xl} color={t.colors.accent} />
          </View>
          <AnimatedTextInput
            editable={false}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            underlineColorAndroid="transparent"
            defaultValue={`~${honestMinutes}`}
            style={numberStyle}
            animatedProps={numberProps}
          />
          <AppText
            style={title}
            accessibilityRole="header"
            accessibilityLabel={`Now an honest number. About ${honestMinutes} minutes.`}
          >
            Now an honest number
          </AppText>
          <AppText style={sub}>Enough real runs that you can trust this one.</AppText>
          <AppButton label="Nice" variant="amber" onPress={onDone} fullWidth />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
