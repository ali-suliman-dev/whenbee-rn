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

/**
 * Opacity for a dead (out-of-window) row on a bounded wheel. Set well below the
 * 0.16 far-fade so an unreachable row reads as "can't go there", not just distant.
 * A drum-picker physics value, not a design token (cf. WHEEL_OPACITY).
 */
export const WHEEL_DISABLED_OPACITY = 0.08 as const;

/**
 * Fraction of a row that peeks above and below the centre band — the scroll cue.
 *
 * The wheel window is `(1 + 2 * peek)` rows tall: one full centre row plus a
 * partial slice of each neighbour. 0.5 = a half-row peek each side — enough of
 * the faded neighbour shows to read as "more above/below" (scrollable) while
 * keeping the wheel compact. Both wheels consume this so they stay in lockstep.
 *
 * This is a drum-picker feel constant, not a design token (cf. WHEEL_OPACITY).
 */
export const WHEEL_SIDE_PEEK = 0.5;

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
  'worklet';
  // Marked a worklet because it is called from UI-thread contexts (useDerivedValue,
  // pan gesture handlers, useAnimatedStyle). Without this directive, Reanimated
  // aborts the app: "Tried to synchronously call a non-worklet function on the UI
  // thread." A worklet called from the JS thread (hourIndex/minuteIndex) just runs
  // normally, so both call sites are safe.
  return Math.min(count - 1, Math.max(0, n));
}

/**
 * Clamp `n` into the closed range [lo, hi].
 *
 * Unlike {@link clampWheelIndex} (which clamps to a 0-based item count), this
 * bounds a value between an explicit lower and upper edge — used to keep a bounded
 * wheel (e.g. the "can't finish in the future" forgot picker) inside its window.
 *
 * Guard: if the range is inverted (`lo > hi`, a collapsed window) it returns `lo`,
 * the single authoritative value, rather than an undefined result.
 *
 * Marked a worklet for the same reason as {@link clampWheelIndex}: it runs inside
 * UI-thread pan handlers and `useDerivedValue`, so without the directive Reanimated
 * aborts the app on Fabric. It also runs fine when called from the JS thread.
 *
 * @example
 *   clampToRange(2, 5, 10)  // → 5   (below lo)
 *   clampToRange(20, 5, 10) // → 10  (above hi)
 *   clampToRange(7, 5, 10)  // → 7   (inside)
 *   clampToRange(7, 10, 5)  // → 10  (inverted guard)
 */
export function clampToRange(n: number, lo: number, hi: number): number {
  'worklet';
  if (lo > hi) return lo;
  return Math.min(hi, Math.max(lo, n));
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
  /** Out-of-window row: rendered dead (dimmed) so a bounded wheel reads its edge. */
  disabled?: boolean;
  /** Opacity for a disabled row — passed as a token (e.g. `t.opacity.disabled`). */
  disabledOpacity?: number;
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
  disabled = false,
  disabledOpacity = WHEEL_DISABLED_OPACITY,
}: WheelRowProps) {
  const animStyle = useAnimatedStyle(() => {
    const centre = -translateY.get() / itemHeight;
    const dist = Math.abs(centre - index);
    return {
      // A disabled (out-of-window) row is dead: a fixed dim, not the distance fade.
      opacity: disabled
        ? disabledOpacity
        : interpolate(dist, [0, 1, 2], WHEEL_OPACITY as unknown as number[], Extrapolation.CLAMP),
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
