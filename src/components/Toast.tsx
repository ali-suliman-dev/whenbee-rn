import { useEffect } from 'react';
import { type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from './AppText';

// ──────────────────────────────────────────────────────────────────────────────
// Toast — Flat Tactical UI
//
// A night-bg pill anchored near the bottom. Fades in over ~300ms, auto-hides
// after ~1.9s. Reduce-motion: instant show/hide (duration:0).
//
// Usage: control visibility with `visible`. The component handles its own
// fade animation; mount/unmount is the caller's responsibility (typically driven
// by a short-lived boolean in component state).
// ──────────────────────────────────────────────────────────────────────────────

const FADE_DURATION = 300;
const AUTO_HIDE_MS = 1900;

export function Toast({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);

  useEffect(() => {
    const dur = reducedMotion ? 0 : FADE_DURATION;
    if (visible) {
      opacity.value = withTiming(1, { duration: dur });
    } else {
      opacity.value = withTiming(0, { duration: dur });
    }
  }, [visible, reducedMotion, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const pill: ViewStyle = {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: t.colors.night,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.space[5],
    paddingVertical: t.space[3],
    maxWidth: '80%',
  };

  const textStyle: TextStyle = {
    color: t.colors.onIndigo,
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    textAlign: 'center',
  };

  if (!visible && opacity.value === 0) return null;

  return (
    <Animated.View
      style={[pill, animStyle]}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
    >
      <AppText style={textStyle}>{message}</AppText>
    </Animated.View>
  );
}

// Convenience hook: returns { show } which sets visible for AUTO_HIDE_MS then clears it.
// Requires the caller to hold `const [toastVisible, setToastVisible] = useState(false)`.
export { AUTO_HIDE_MS };
