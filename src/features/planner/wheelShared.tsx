/**
 * wheelShared — shared primitives for DurationWheel and FinishTimeWheel.
 *
 * Exports:
 *  - clampWheelIndex   pure helper; tested in __tests__/wheel.test.ts
 *  - WHEEL_OPACITY     physics constants (animation, not theme tokens)
 *  - WHEEL_SCALE       physics constants (animation, not theme tokens)
 *  - WheelRow          animated row sub-component used by both wheels
 */

import { memo } from 'react';
import { Text, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

// ── physics / animation constants ─────────────────────────────────────────────
// These govern how neighbouring rows fade and shrink as they move away from
// centre. They are wheel-physics values, not design tokens — they encode the
// feel of the drum-picker, not a brand decision.

/** Opacity levels for centre (dist=0), adjacent (dist=1), far (dist=2) rows. */
export const WHEEL_OPACITY = [1, 0.45, 0.16] as const;

/** Scale levels for centre (dist=0) and adjacent (dist=1) rows. */
export const WHEEL_SCALE = [1, 0.84] as const;

// ── clamping helper ───────────────────────────────────────────────────────────

/**
 * Clamp `n` to the valid index range [0, count - 1].
 *
 * `count` is the TOTAL number of items (not count-1). The caller must pass
 * the raw count; this function subtracts 1 internally so the last item is
 * always reachable.
 *
 * @example
 *   clampWheelIndex(100, 36) // → 35  (last index for 36 items)
 *   clampWheelIndex(-1,  36) // → 0
 */
export function clampWheelIndex(n: number, count: number): number {
  return Math.min(count - 1, Math.max(0, n));
}

// ── WheelRow ──────────────────────────────────────────────────────────────────

export type WheelRowProps = {
  index: number;
  label: string;
  itemHeight: number;
  translateY: SharedValue<number>;
  isSelected: boolean;
  inkColor: string;
  inkFaintColor: string;
  fontSize: number;
};

export const WheelRow = memo(function WheelRow({
  index,
  label,
  itemHeight,
  translateY,
  isSelected,
  inkColor,
  inkFaintColor,
  fontSize,
}: WheelRowProps) {
  const animStyle = useAnimatedStyle(() => {
    const centre = -translateY.get() / itemHeight;
    const dist = Math.abs(centre - index);
    return {
      opacity: interpolate(
        dist,
        [0, 1, 2],
        WHEEL_OPACITY as unknown as number[],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            dist,
            [0, 1],
            WHEEL_SCALE as unknown as number[],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const textStyle: TextStyle = {
    fontFamily: isSelected ? 'Inter-Bold' : 'Inter-SemiBold',
    fontSize,
    color: isSelected ? inkColor : inkFaintColor,
    fontVariant: ['tabular-nums'],
  };

  return (
    <Animated.View
      style={[{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }, animStyle]}
    >
      <Text style={textStyle}>{label}</Text>
    </Animated.View>
  );
});
