import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// DurationWheel — slim vertical pan-wheel for picking minutes.
//
// 3 visible rows. The centre row sits in a `surfaceSunken` pill (`radii.full`).
// Neighbours render at `inkFaint` opacity. Step defaults to 5 minutes.
//
// Physics are identical to TimeField: a Reanimated Pan gesture (NOT a
// ScrollView) so it plays nicely inside any parent scroll. Velocity fling-
// projects to the nearest step, springs to rest, and fires a light haptic
// on each row crossing.
// ──────────────────────────────────────────────────────────────────────────────

const VISIBLE_ITEMS = 3; // odd → one row is dead-centre
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

function clampIndex(n: number, count: number): number {
  return Math.min(count - 1, Math.max(0, n));
}

// ── sub-component: one row of the wheel ─────────────────────────────────────

const WheelRow = memo(function WheelRow({
  index,
  label,
  itemHeight,
  translateY,
  isSelected,
  inkColor,
  inkFaintColor,
  fontSize,
}: {
  index: number;
  label: string;
  itemHeight: number;
  translateY: SharedValue<number>;
  isSelected: boolean;
  inkColor: string;
  inkFaintColor: string;
  fontSize: number;
}) {
  const animStyle = useAnimatedStyle(() => {
    const centre = -translateY.get() / itemHeight;
    const dist = Math.abs(centre - index);
    return {
      opacity: interpolate(dist, [0, 1, 2], [1, 0.45, 0.16], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(dist, [0, 1], [1, 0.84], Extrapolation.CLAMP) }],
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

// ── main component ────────────────────────────────────────────────────────────

export function DurationWheel({
  valueMin,
  step = 5,
  onChange,
}: {
  /** Currently selected duration in minutes. */
  valueMin: number;
  /** Snap step in minutes. Defaults to 5. */
  step?: number;
  onChange: (minutes: number) => void;
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
    return idx >= 0 ? idx : clampIndex(Math.round(min / step) - 1, count);
  }

  const itemHeight = t.size.control.sm; // 36pt — compact rows
  const wheelHeight = itemHeight * VISIBLE_ITEMS;
  const pad = ((VISIBLE_ITEMS - 1) / 2) * itemHeight;
  const spring = t.motion.spring;

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
  const liveIndex = useDerivedValue(() =>
    Math.round(clampIndex(-translateY.get() / itemHeight, count - 1)),
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
          const idx = clampIndex(rawIdx, count - 1);
          translateY.set(withSpring(-idx * itemHeight, spring));
          runOnJS(commitIndex)(idx);
        }),
    [itemHeight, spring, startY, translateY, commitIndex, count],
  );

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const container: ViewStyle = {
    height: wheelHeight,
    overflow: 'hidden',
  };

  // Centre highlight pill — `surfaceSunken` background, full-radius pill.
  const highlight: ViewStyle = {
    position: 'absolute',
    top: pad,
    left: t.space[2],
    right: t.space[2],
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
          commitIndex(clampIndex(idx + 1, count - 1));
        else if (e.nativeEvent.actionName === 'decrement')
          commitIndex(clampIndex(idx - 1, count - 1));
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
