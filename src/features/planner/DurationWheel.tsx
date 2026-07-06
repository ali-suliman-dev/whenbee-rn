import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction,
  withSpring,
  runOnJS,
  useReducedMotion,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { clampWheelIndex, WheelRow, WHEEL_SIDE_PEEK } from './wheelShared';

// ──────────────────────────────────────────────────────────────────────────────
// DurationWheel — slim vertical pan-wheel for picking minutes.
//
// Centre row in a `surfaceSunken` pill (`radii.full`), with a half-row peek of
// the faded neighbour each side (WHEEL_SIDE_PEEK) as the scroll cue — compact,
// not three full rows. Neighbours render at `inkFaint` opacity. Step = 5 minutes.
//
// Physics are identical to TimeField: a Reanimated Pan gesture (NOT a
// ScrollView) so it plays nicely inside any parent scroll. Velocity fling-
// projects to the nearest step, springs to rest, and fires a light haptic
// on each row crossing.
// ──────────────────────────────────────────────────────────────────────────────

const FLING_PROJECTION = 0.1;
const DEFAULT_VALUE_MIN = 10;

/** Round n to the nearest multiple of step. */
function snapToStep(n: number, step: number): number {
  return Math.round(n / step) * step;
}

type WheelItem = { value: number; label: string };

function fmtMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function buildData(step: number): WheelItem[] {
  // 1 up to 180 minutes, only multiples of step — plus the step-rounded default
  // so the wheel always has the user's current value available.
  const items: WheelItem[] = [];
  for (let v = step; v <= 180; v += step) {
    items.push({ value: v, label: fmtMin(v) });
  }
  return items;
}

// ── main component ────────────────────────────────────────────────────────────

export function DurationWheel({
  valueMin,
  step = 5,
  onChange,
  fullWidth = false,
}: {
  /** Currently selected duration in minutes. */
  valueMin: number;
  /** Snap step in minutes. Defaults to 5. */
  step?: number;
  onChange: (minutes: number) => void;
  /** Stretch the wheel to fill its parent's width instead of the fixed pill column. */
  fullWidth?: boolean;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Build data only when step changes (stable across renders).
  const data = useMemo(() => buildData(step), [step]);
  const count = data.length;

  // Resolve the initial index: nearest step-aligned value.
  function indexOfValue(min: number): number {
    const stepped = snapToStep(min, step);
    const idx = data.findIndex((d) => d.value === stepped);
    return idx >= 0 ? idx : clampWheelIndex(Math.round(min / step) - 1, count);
  }

  const itemHeight = t.size.wheelRow; // 32pt — tight rows, neighbours sit close
  // Centre row + a half-row peek each side (scroll cue) — compact, not 3 full rows.
  const pad = itemHeight * WHEEL_SIDE_PEEK;
  const wheelHeight = itemHeight * (1 + 2 * WHEEL_SIDE_PEEK);
  const spring = t.motion.wheelSnap;

  const initialIndex = indexOfValue(valueMin);
  const translateY = useSharedValue(-initialIndex * itemHeight);
  const startY = useSharedValue(0);
  const committedIndex = useRef(initialIndex);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const commitIndex = useCallback(
    (idx: number) => {
      committedIndex.current = idx;
      setSelectedIndex(idx);
      const item = data[idx];
      if (item !== undefined && item.value !== valueMin) onChange(item.value);
    },
    [data, onChange, valueMin],
  );

  // External value change (e.g. chip tap from a parent) → spring the wheel.
  useEffect(() => {
    const target = indexOfValue(valueMin);
    if (target === committedIndex.current) return;
    committedIndex.current = target;
    setSelectedIndex(target);
    const dest = -target * itemHeight;
    translateY.set(reducedMotion ? dest : withSpring(dest, spring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMin, itemHeight, reducedMotion, spring]);

  // Haptic tick on each crossing row.
  // Fix: pass `count` (not `count - 1`) so clampWheelIndex correctly
  // allows the last index (count - 1) to be reached.
  const liveIndex = useDerivedValue(() =>
    Math.round(clampWheelIndex(-translateY.get() / itemHeight, count)),
  );
  useAnimatedReaction(
    () => liveIndex.get(),
    (cur, prev) => {
      if (prev !== null && cur !== prev) runOnJS(haptics.light)();
    },
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onStart(() => {
          startY.set(translateY.get());
        })
        .onUpdate((e) => {
          translateY.set(startY.get() + e.translationY);
        })
        .onEnd((e) => {
          const projected = translateY.get() + e.velocityY * FLING_PROJECTION;
          const rawIdx = Math.round(-projected / itemHeight);
          // Fix: pass `count` (not `count - 1`) so the last item is reachable.
          const idx = clampWheelIndex(rawIdx, count);
          translateY.set(withSpring(-idx * itemHeight, spring));
          runOnJS(commitIndex)(idx);
        }),
    [itemHeight, spring, startY, translateY, commitIndex, count],
  );

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const container: ViewStyle = {
    width: fullWidth ? '100%' : t.size.wheelCol,
    height: wheelHeight,
    overflow: 'hidden',
  };

  // Centre highlight pill — `surfaceSunken` fill, full-radius. Spans the whole
  // column width (wider than tall) so it reads as a pill, not a circle.
  const highlight: ViewStyle = {
    position: 'absolute',
    top: pad,
    left: 0,
    right: 0,
    height: itemHeight,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
  };

  const currentValue = data[selectedIndex]?.value ?? valueMin;

  return (
    <View
      style={container}
      accessibilityRole="adjustable"
      accessibilityLabel="Duration in minutes"
      accessibilityValue={{
        min: step,
        max: 180,
        now: currentValue,
        text: fmtMin(currentValue),
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const idx = indexOfValue(valueMin);
        if (e.nativeEvent.actionName === 'increment')
          // Fix: pass `count` (not `count - 1`) so the last item is reachable.
          commitIndex(clampWheelIndex(idx + 1, count));
        else if (e.nativeEvent.actionName === 'decrement')
          // Fix: pass `count` (not `count - 1`) so decrement stays in range.
          commitIndex(clampWheelIndex(idx - 1, count));
      }}
    >
      <View style={highlight} pointerEvents="none" />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ paddingVertical: pad }, listStyle]}>
          {data.map((item, index) => (
            <WheelRow
              key={item.value}
              index={index}
              label={item.label}
              itemHeight={itemHeight}
              translateY={translateY}
              isSelected={index === selectedIndex}
              inkColor={t.colors.ink}
              inkFaintColor={t.colors.inkFaint}
              fontSize={t.fontSize.base}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export { DEFAULT_VALUE_MIN };
