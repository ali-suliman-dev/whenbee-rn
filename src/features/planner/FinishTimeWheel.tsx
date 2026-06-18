import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
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
import { Chip } from '@/src/components/Chip';
import { clampWheelIndex, WheelRow } from './wheelShared';

// ──────────────────────────────────────────────────────────────────────────────
// FinishTimeWheel — two-column HH : MM pan-wheel for picking a deadline time.
//
// Layout:
//   [mode chips]   leave by / be done by / be at
//   [HH wheel] : [MM wheel]
//
// Hours column: 0–23, step 1.
// Minutes column: 0–55, step 5.
//
// Both columns share the same wheel physics as DurationWheel (and TimeField):
// Reanimated Pan, fling-project, spring-snap, light haptic on row crossing.
//
// `onChange` is called with the chosen time as epoch ms on today's calendar day.
// `valueMs` drives the wheels externally; null → defaults to the next whole hour.
// ──────────────────────────────────────────────────────────────────────────────

const MINUTE_STEP = 5;
const VISIBLE_ITEMS = 3;
const FLING_PROJECTION = 0.1;

// ── mode chip labels ──────────────────────────────────────────────────────────

type DeadlineMode = 'leave by' | 'be done by' | 'be at';
const MODES: DeadlineMode[] = ['leave by', 'be done by', 'be at'];

// ── helpers ───────────────────────────────────────────────────────────────────

function hoursData(): { value: number; label: string }[] {
  return Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, '0'),
  }));
}

function minutesData(): { value: number; label: string }[] {
  const items = [];
  for (let m = 0; m < 60; m += MINUTE_STEP) {
    items.push({ value: m, label: String(m).padStart(2, '0') });
  }
  return items;
}

const HOURS = hoursData();
const MINUTES = minutesData();
const HOUR_COUNT = HOURS.length; // 24
const MIN_COUNT = MINUTES.length; // 12

/** Epoch ms for hour:minute on the calendar day of `baseMs`. */
function todayAt(hour: number, minute: number, baseMs: number): number {
  const d = new Date(baseMs);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Extract { hour, minute } from epoch ms. Minutes are snapped to MINUTE_STEP. */
function decompose(ms: number): { hour: number; minute: number } {
  const d = new Date(ms);
  const minute = Math.round(d.getMinutes() / MINUTE_STEP) * MINUTE_STEP;
  return { hour: d.getHours(), minute: minute >= 60 ? 55 : minute };
}

function hourIndex(hour: number): number {
  return clampWheelIndex(hour, HOUR_COUNT);
}

function minuteIndex(minute: number): number {
  const idx = MINUTES.findIndex((m) => m.value === minute);
  return idx >= 0 ? idx : clampWheelIndex(Math.round(minute / MINUTE_STEP), MIN_COUNT);
}

// ── column wheel (hours or minutes) ──────────────────────────────────────────

function ColumnWheel({
  data,
  selectedIndex,
  onIndexChange,
  itemHeight,
  spring,
  inkColor,
  inkFaintColor,
  fontSize,
  accessibilityLabel,
  accessibilityMin,
  accessibilityMax,
  accessibilityValue,
  reducedMotion,
}: {
  data: { value: number; label: string }[];
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
  itemHeight: number;
  spring: { damping: number; stiffness: number };
  inkColor: string;
  inkFaintColor: string;
  fontSize: number;
  accessibilityLabel: string;
  accessibilityMin: number;
  accessibilityMax: number;
  accessibilityValue: number;
  reducedMotion: boolean;
}) {
  const count = data.length;
  const pad = ((VISIBLE_ITEMS - 1) / 2) * itemHeight;
  const wheelHeight = itemHeight * VISIBLE_ITEMS;

  const translateY = useSharedValue(-selectedIndex * itemHeight);
  const startY = useSharedValue(0);
  const committedIndex = useRef(selectedIndex);

  const commitIdx = useCallback(
    (idx: number) => {
      committedIndex.current = idx;
      onIndexChange(idx);
    },
    [onIndexChange],
  );

  // External change → spring to new position.
  useEffect(() => {
    if (selectedIndex === committedIndex.current) return;
    committedIndex.current = selectedIndex;
    const dest = -selectedIndex * itemHeight;
    translateY.set(reducedMotion ? dest : withSpring(dest, spring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, itemHeight, reducedMotion, spring]);

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
          const idx = clampWheelIndex(Math.round(-projected / itemHeight), count);
          translateY.set(withSpring(-idx * itemHeight, spring));
          runOnJS(commitIdx)(idx);
        }),
    [itemHeight, spring, startY, translateY, commitIdx, count],
  );

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const container: ViewStyle = { height: wheelHeight, overflow: 'hidden', flex: 1 };

  return (
    <View
      style={container}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: accessibilityMin,
        max: accessibilityMax,
        now: accessibilityValue,
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment')
          commitIdx(clampWheelIndex(committedIndex.current + 1, count));
        else if (e.nativeEvent.actionName === 'decrement')
          commitIdx(clampWheelIndex(committedIndex.current - 1, count));
      }}
    >
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
              inkColor={inkColor}
              inkFaintColor={inkFaintColor}
              fontSize={fontSize}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function FinishTimeWheel({
  valueMs,
  mode,
  onChange,
  nowMs,
}: {
  /** Selected deadline as epoch ms. If null/undefined, defaults to the next whole hour. */
  valueMs: number | null;
  /** Which deadline semantic is active. */
  mode: DeadlineMode;
  onChange: (deadlineMs: number, mode: DeadlineMode) => void;
  /** I3: injected clock — avoids new Date() calls for deterministic tests + midnight safety. */
  nowMs?: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Resolve initial hour/minute from valueMs or default to next whole hour.
  const defaultMs = useMemo(() => {
    const d = new Date(nowMs ?? Date.now());
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.getTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = valueMs ?? defaultMs;
  const initial = useMemo(() => decompose(resolved), [resolved]);

  const [hIdx, setHIdx] = useState(() => hourIndex(initial.hour));
  const [mIdx, setMIdx] = useState(() => minuteIndex(initial.minute));

  // When valueMs changes externally, sync indices.
  const prevMs = useRef(resolved);
  useEffect(() => {
    if (valueMs === null || valueMs === prevMs.current) return;
    prevMs.current = valueMs;
    const dec = decompose(valueMs);
    setHIdx(hourIndex(dec.hour));
    setMIdx(minuteIndex(dec.minute));
  }, [valueMs]);

  const emitChange = useCallback(
    (newHIdx: number, newMIdx: number, newMode: DeadlineMode) => {
      const h = HOURS[newHIdx]?.value ?? 0;
      const m = MINUTES[newMIdx]?.value ?? 0;
      // I3: use injected nowMs so todayAt anchors to the right calendar day.
      onChange(todayAt(h, m, nowMs ?? Date.now()), newMode);
    },
    [onChange, nowMs],
  );

  const handleHourChange = useCallback(
    (idx: number) => {
      setHIdx(idx);
      emitChange(idx, mIdx, mode);
    },
    [emitChange, mIdx, mode],
  );

  const handleMinuteChange = useCallback(
    (idx: number) => {
      setMIdx(idx);
      emitChange(hIdx, idx, mode);
    },
    [emitChange, hIdx, mode],
  );

  const handleModePress = useCallback(
    (newMode: DeadlineMode) => {
      haptics.selection();
      emitChange(hIdx, mIdx, newMode);
    },
    [emitChange, hIdx, mIdx],
  );

  const itemHeight = t.size.control.sm; // 36pt — matches DurationWheel
  const wheelHeight = itemHeight * VISIBLE_ITEMS;
  const pad = ((VISIBLE_ITEMS - 1) / 2) * itemHeight;

  // Shared highlight pill covers both columns — positioned to span the two wheels.
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

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    height: wheelHeight,
  };

  const separator: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.lg,
    color: t.colors.ink,
    paddingHorizontal: t.space[1],
    // Optical alignment: the colon sits at the centre band height, not the container top.
    marginTop: 0,
  };

  const chipRow: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space[2],
    marginBottom: t.space[3],
  };

  return (
    <View>
      {/* Mode chips */}
      <View style={chipRow}>
        {MODES.map((m) => (
          <Chip key={m} label={m} selected={mode === m} onPress={() => handleModePress(m)} />
        ))}
      </View>

      {/* Dual wheel */}
      <View style={{ position: 'relative' }}>
        <View style={highlight} pointerEvents="none" />
        <View style={row}>
          <ColumnWheel
            data={HOURS}
            selectedIndex={hIdx}
            onIndexChange={handleHourChange}
            itemHeight={itemHeight}
            spring={t.motion.spring}
            inkColor={t.colors.ink}
            inkFaintColor={t.colors.inkFaint}
            fontSize={t.fontSize.base}
            accessibilityLabel="Hour"
            accessibilityMin={0}
            accessibilityMax={23}
            accessibilityValue={HOURS[hIdx]?.value ?? 0}
            reducedMotion={reducedMotion}
          />

          <Text style={separator}>:</Text>

          <ColumnWheel
            data={MINUTES}
            selectedIndex={mIdx}
            onIndexChange={handleMinuteChange}
            itemHeight={itemHeight}
            spring={t.motion.spring}
            inkColor={t.colors.ink}
            inkFaintColor={t.colors.inkFaint}
            fontSize={t.fontSize.base}
            accessibilityLabel="Minute"
            accessibilityMin={0}
            accessibilityMax={55}
            accessibilityValue={MINUTES[mIdx]?.value ?? 0}
            reducedMotion={reducedMotion}
          />
        </View>
      </View>
    </View>
  );
}

export type { DeadlineMode };
