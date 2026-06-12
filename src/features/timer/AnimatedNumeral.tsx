import { TextInput, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

// ──────────────────────────────────────────────────────────────────────────────
// AnimatedNumeral — renders a shared-value integer WITHOUT React state.
//
// The canonical RN/Reanimated trick: an AnimatedTextInput whose `text` prop is
// driven by useAnimatedProps. The worklet writes the formatted number straight to
// the native view each time the shared value bumps a minute, so the big timer
// numeral updates on the UI thread with zero per-second re-render. The colour
// flips to amber on overrun via an animated style (also UI-thread). Read-only +
// non-editable so it behaves as a label.
// ──────────────────────────────────────────────────────────────────────────────

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function AnimatedNumeral({
  minutes,
  overProgress,
  style,
  amberColor,
  inkColor,
}: {
  minutes: SharedValue<number>;
  overProgress: SharedValue<number>;
  style: TextStyle;
  amberColor: string;
  inkColor: string;
}) {
  // `text` is a native-only prop on AnimatedTextInput (not in TextInputProps),
  // so it's whitelisted above and the worklet return is cast to the prop type.
  const animatedProps = useAnimatedProps(
    () =>
      ({ text: String(minutes.value) } as unknown as Partial<
        import('react-native').TextInputProps
      >),
  );

  const colorStyle = useAnimatedStyle(() => ({
    color: overProgress.value === 1 ? amberColor : inkColor,
  }));

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      underlineColorAndroid="transparent"
      defaultValue="0"
      style={[style, { padding: 0 }, colorStyle]}
      animatedProps={animatedProps}
    />
  );
}
