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
import { TimeChips } from './TimeChips';

// ──────────────────────────────────────────────────────────────────────────────
// TimeField — minutes input that isn't trapped on 5/10/15/30/45/1h.
//
//   [5m][10m][15m][30m][45m][1h]      ← quick jumps (recognition, Fitts-friendly)
//          14m                         ← drag the wheel for any whole minute (1–180)
//   ┌───── 15m ─────┐
//          16m
//
// The wheel is a Reanimated + gesture-handler Pan — NOT a ScrollView. A native
// scroll wheel nested inside the modal's own ScrollView fought for the touch
// responder (the page wouldn't scroll, the inputs wouldn't tap). A Pan gesture is
// bounded to this view, so it only moves the wheel when dragged *on* the wheel and
// never steals taps from the chips, the inputs, or the page scroll.
//
// Chip ↔ wheel sync both ways: a tapped chip springs the wheel to it; landing the
// wheel on a non-preset value just leaves the chips unhighlighted (TimeChips keys
// off `value === min`). `value` may be null (retro starts empty) — the wheel rests
// on DEFAULT_START until touched, and the parent stays null until the first commit.
// ──────────────────────────────────────────────────────────────────────────────

const MIN = 1;
const MAX = 180; // 3h is plenty for a fine-tune wheel; chips cover the big jumps.
const DEFAULT_START = 10;
const VISIBLE_ITEMS = 3; // odd, so one row sits dead-centre; keeps the wheel short.
// How much wheel-end velocity carries into the snap target (fling projection).
const FLING_PROJECTION = 0.1;

function fmt(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type WheelItem = { value: number; label: string };

// Built once at module load (static 1–180 list) — never per render.
const DATA: WheelItem[] = Array.from({ length: MAX - MIN + 1 }, (_, i) => {
  const value = i + MIN;
  return { value, label: fmt(value) };
});
const COUNT = DATA.length;

function clampIndex(n: number): number {
  return Math.min(COUNT - 1, Math.max(0, n));
}
// minutes → list index (DATA[index].value === index + MIN).
function indexOfValue(value: number | null): number {
  return clampIndex((value ?? DEFAULT_START) - MIN);
}

export function TimeField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (min: number) => void;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const itemHeight = t.size.control.sm; // 36 — keeps a 5-row wheel compact.
  const wheelHeight = itemHeight * VISIBLE_ITEMS;
  const pad = ((VISIBLE_ITEMS - 1) / 2) * itemHeight; // centres the first/last row.
  const spring = t.motion.spring;

  const initialIndex = indexOfValue(value);
  const translateY = useSharedValue(-initialIndex * itemHeight);
  const startY = useSharedValue(0);
  // Mirrors the committed index on the JS thread (drives the bold-centre row +
  // guards the chip-sync effect from fighting a fresh wheel commit).
  const committedIndex = useRef(initialIndex);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const commitIndex = useCallback(
    (idx: number) => {
      committedIndex.current = idx;
      setSelectedIndex(idx);
      const item = DATA[idx];
      if (item && item.value !== value) onChange(item.value);
    },
    [onChange, value],
  );

  // Chip tap (or any external value change) → spring the wheel to it. Skip when the
  // change is the wheel's own commit echoing back through `value`.
  useEffect(() => {
    const target = indexOfValue(value);
    if (target === committedIndex.current) return;
    committedIndex.current = target;
    setSelectedIndex(target);
    const dest = -target * itemHeight;
    translateY.set(reducedMotion ? dest : withSpring(dest, spring));
  }, [value, itemHeight, reducedMotion, spring, translateY]);

  // Light haptic each time a new row crosses the centre — the wheel "tick".
  const liveIndex = useDerivedValue(() =>
    Math.round(Math.min(COUNT - 1, Math.max(0, -translateY.get() / itemHeight))),
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
        .activeOffsetY([-8, 8]) // claim only real vertical drags; let taps pass.
        .onStart(() => {
          startY.set(translateY.get());
        })
        .onUpdate((e) => {
          translateY.set(startY.get() + e.translationY);
        })
        .onEnd((e) => {
          // Project the fling, snap to the nearest in-range row.
          const projected = translateY.get() + e.velocityY * FLING_PROJECTION;
          const idx = Math.min(COUNT - 1, Math.max(0, Math.round(-projected / itemHeight)));
          translateY.set(withSpring(-idx * itemHeight, spring));
          runOnJS(commitIndex)(idx);
        }),
    [itemHeight, spring, startY, translateY, commitIndex],
  );

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const container: ViewStyle = {
    height: wheelHeight,
    overflow: 'hidden',
  };
  const highlight: ViewStyle = {
    position: 'absolute',
    top: pad,
    left: t.space[4],
    right: t.space[4],
    height: itemHeight,
    backgroundColor: t.colors.surface, // chip-style lifted band — clearer than the sunken well.
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
  };
  const itemBase: TextStyle = {
    fontFamily: 'Inter-SemiBold',
    fontSize: t.fontSize.lg,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View style={{ gap: t.space[3] }}>
      <TimeChips value={value} onChange={onChange} />

      <View style={container}>
        <View style={highlight} pointerEvents="none" />
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ paddingVertical: pad }, listStyle]}>
            {DATA.map((item, index) => (
              <WheelRow
                key={item.value}
                index={index}
                label={item.label}
                itemHeight={itemHeight}
                translateY={translateY}
                textStyle={itemBase}
                bold={index === selectedIndex}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

// One wheel row. Opacity + scale fall off with distance from the centre so the
// stack reads as a curved drum; the centred row goes bold on settle.
const WheelRow = memo(function WheelRow({
  index,
  label,
  itemHeight,
  translateY,
  textStyle,
  bold,
}: {
  index: number;
  label: string;
  itemHeight: number;
  translateY: SharedValue<number>;
  textStyle: TextStyle;
  bold: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const centre = -translateY.get() / itemHeight; // fractional centred index
    const dist = Math.abs(centre - index);
    return {
      opacity: interpolate(dist, [0, 1, 2], [1, 0.45, 0.16], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(dist, [0, 1], [1, 0.84], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Animated.View
      style={[{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Text style={[textStyle, bold ? { fontFamily: 'Inter-Bold' } : null]}>{label}</Text>
    </Animated.View>
  );
});
