import { TextInput, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

// ──────────────────────────────────────────────────────────────────────────────
// AnimatedNumeral — renders a shared-value string WITHOUT React state.
//
// The canonical RN/Reanimated trick: an AnimatedTextInput whose `text` prop is
// driven by useAnimatedProps. The worklet writes the pre-formatted string straight
// to the native view each tick, so the big timer clock (m:ss) updates on the UI
// thread with zero per-second re-render. The colour flips to amber on overrun via
// an animated style (also UI-thread). Read-only + non-editable so it's a label.
// ──────────────────────────────────────────────────────────────────────────────

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function AnimatedNumeral({
  text,
  overProgress,
  style,
  amberColor,
  inkColor,
  defaultText = '0',
}: {
  /** Pre-formatted display string (e.g. "0:07"), updated on the UI thread. */
  text: SharedValue<string>;
  overProgress: SharedValue<number>;
  style: TextStyle;
  amberColor: string;
  inkColor: string;
  defaultText?: string;
}) {
  // `text` is a native-only prop on AnimatedTextInput (not in TextInputProps),
  // so it's whitelisted above and the worklet return is cast to the prop type.
  const animatedProps = useAnimatedProps(
    () =>
      ({ text: text.value } as unknown as Partial<
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
      defaultValue={defaultText}
      style={[style, { padding: 0 }, colorStyle]}
      animatedProps={animatedProps}
    />
  );
}
