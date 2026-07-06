import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedReaction,
  withSpring,
  runOnJS,
  useReducedMotion,
  FadeIn,
  ReduceMotion,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { Chip } from '@/src/components/Chip';
import { clampWheelIndex, WheelRow, WHEEL_SIDE_PEEK } from './wheelShared';
import {
  bufferFromHourMinute,
  bufferToHourMinute,
  formatBuffer,
  popDigit,
  pushDigit,
} from './timeKeypad';

// ──────────────────────────────────────────────────────────────────────────────
// FinishTimeWheel — two-column HH : MM pan-wheel for picking a deadline time.
//
// Layout:
//   [mode chips]   leave by / be done by / be at        (showModes)
//   [HH:MM readout]                                      (editable — tap to type)
//   [HH wheel] : [MM wheel]   ⇄   [numeric keypad]
//
// Hours column: 0–23, step 1.
// Minutes column: step 5 by default; step 1 when `editable` so the wheel can land
// on the exact minute the keypad can type (otherwise switching back to the wheel
// would snap 47 → 45 and silently clobber a typed value).
//
// `editable` adds a large tappable readout above the wheel. Tapping it crossfades
// the wheel into an iOS-style numeric keypad (opacity only — no slide/bounce, and
// `entering`-only so a conditionally-unmounted view never triggers the Fabric
// exiting-animation crash). Digit-entry logic lives in the pure `timeKeypad`.
//
// Both columns share the same wheel physics as DurationWheel (and TimeField):
// Reanimated Pan, fling-project, spring-snap, light haptic on row crossing.
//
// `onChange` is called with the chosen time as epoch ms on today's calendar day.
// `valueMs` drives the wheels externally; null → defaults to the next whole hour.
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_MINUTE_STEP = 5;
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

function minutesData(step: number): { value: number; label: string }[] {
  const items = [];
  for (let m = 0; m < 60; m += step) {
    items.push({ value: m, label: String(m).padStart(2, '0') });
  }
  return items;
}

const HOURS = hoursData();
const HOUR_COUNT = HOURS.length; // 24

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Epoch ms for hour:minute on the calendar day of `baseMs`. */
function todayAt(hour: number, minute: number, baseMs: number): number {
  const d = new Date(baseMs);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Extract { hour, minute } from epoch ms. Minutes are snapped to `step`. */
function decompose(ms: number, step: number): { hour: number; minute: number } {
  const d = new Date(ms);
  const minute = Math.round(d.getMinutes() / step) * step;
  return { hour: d.getHours(), minute: minute >= 60 ? 60 - step : minute };
}

function hourIndex(hour: number): number {
  return clampWheelIndex(hour, HOUR_COUNT);
}

function minuteIndex(minute: number, minutes: { value: number }[], step: number): number {
  const idx = minutes.findIndex((m) => m.value === minute);
  return idx >= 0 ? idx : clampWheelIndex(Math.round(minute / step), minutes.length);
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
  // Centre row + a half-row peek each side (scroll cue) — compact, not 3 full rows.
  const pad = itemHeight * WHEEL_SIDE_PEEK;
  const wheelHeight = itemHeight * (1 + 2 * WHEEL_SIDE_PEEK);

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

// ── numeric keypad (editable mode) ────────────────────────────────────────────

const KEYS: (string | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', '⌫'];

function Keypad({ onDigit, onBackspace }: { onDigit: (d: string) => void; onBackspace: () => void }) {
  const t = useTheme();

  const key: ViewStyle = {
    height: t.size.control.md,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surfaceSunken,
  };
  const keyText: TextStyle = {
    fontFamily: 'Inter-Medium',
    fontSize: t.fontSize.lg,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
      {KEYS.map((k, i) => {
        // 3-per-row grid: each cell is a third of the width minus the two gaps.
        const cell: ViewStyle = { width: `${100 / 3}%`, paddingHorizontal: t.space[1] };
        if (k === null) return <View key={`gap-${i}`} style={cell} />;
        const isBack = k === '⌫';
        return (
          <View key={k} style={cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isBack ? 'Delete' : `Digit ${k}`}
              onPress={() => {
                haptics.light();
                if (isBack) onBackspace();
                else onDigit(k);
              }}
            >
              <View style={[key, isBack ? { backgroundColor: 'transparent' } : null]}>
                {isBack ? (
                  <Ionicons name="backspace-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
                ) : (
                  <Text style={keyText}>{k}</Text>
                )}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function FinishTimeWheel({
  valueMs,
  mode = 'be done by',
  onChange,
  nowMs,
  showModes = true,
  editable = false,
}: {
  /** Selected deadline as epoch ms. If null/undefined, defaults to the next whole hour. */
  valueMs: number | null;
  /** Which deadline semantic is active. Defaults to 'be done by' (used when modes are hidden). */
  mode?: DeadlineMode;
  onChange: (deadlineMs: number, mode: DeadlineMode) => void;
  /** I3: injected clock — avoids new Date() calls for deterministic tests + midnight safety. */
  nowMs?: number;
  /** When false, hide the mode chip row so the wheel is a plain time picker. Default true. */
  showModes?: boolean;
  /** Add a large tappable readout that flips the wheel into a type-any-minute keypad. */
  editable?: boolean;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Editable mode lets the keypad type any minute, so the wheel must step by 1 to
  // land on it exactly; otherwise a typed 47 snaps back to 45 on the wheel.
  const minuteStep = editable ? 1 : DEFAULT_MINUTE_STEP;
  const minutes = useMemo(() => minutesData(minuteStep), [minuteStep]);

  // Resolve initial hour/minute from valueMs or default to next whole hour.
  const defaultMs = useMemo(() => {
    const d = new Date(nowMs ?? Date.now());
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.getTime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = valueMs ?? defaultMs;
  const initial = useMemo(() => decompose(resolved, minuteStep), [resolved, minuteStep]);

  const [hIdx, setHIdx] = useState(() => hourIndex(initial.hour));
  const [mIdx, setMIdx] = useState(() => minuteIndex(initial.minute, minutes, minuteStep));

  // Keypad (editable) state: whether the keypad is showing + the digit buffer.
  const [typing, setTyping] = useState(false);
  const [buffer, setBuffer] = useState('');

  // When valueMs changes externally, sync indices.
  const prevMs = useRef(resolved);
  useEffect(() => {
    if (valueMs === null || valueMs === prevMs.current) return;
    prevMs.current = valueMs;
    const dec = decompose(valueMs, minuteStep);
    setHIdx(hourIndex(dec.hour));
    setMIdx(minuteIndex(dec.minute, minutes, minuteStep));
  }, [valueMs, minuteStep, minutes]);

  const emitChange = useCallback(
    (newHIdx: number, newMIdx: number, newMode: DeadlineMode) => {
      const h = HOURS[newHIdx]?.value ?? 0;
      const m = minutes[newMIdx]?.value ?? 0;
      // I3: use injected nowMs so todayAt anchors to the right calendar day.
      onChange(todayAt(h, m, nowMs ?? Date.now()), newMode);
    },
    [onChange, nowMs, minutes],
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

  // Current hour/minute values (for the readout + keypad seed).
  const curHour = HOURS[hIdx]?.value ?? 0;
  const curMin = minutes[mIdx]?.value ?? 0;

  // Commit a keypad buffer: update the wheel indices AND emit. Kept in sync so
  // toggling back to the wheel shows the typed time.
  const commitBuffer = useCallback(
    (next: string) => {
      const hm = bufferToHourMinute(next);
      if (hm === null) return;
      const newHIdx = hourIndex(hm.hour);
      const newMIdx = minuteIndex(hm.minute, minutes, minuteStep);
      setHIdx(newHIdx);
      setMIdx(newMIdx);
      emitChange(newHIdx, newMIdx, mode);
    },
    [emitChange, minutes, minuteStep, mode],
  );

  const handleDigit = useCallback(
    (d: string) => {
      setBuffer((prev) => {
        const next = pushDigit(prev, d);
        // Rejected (would be an invalid time) — leave the buffer untouched, quietly.
        if (next === prev) return prev;
        commitBuffer(next);
        return next;
      });
    },
    [commitBuffer],
  );

  const handleBackspace = useCallback(() => {
    setBuffer((prev) => {
      const next = popDigit(prev);
      commitBuffer(next);
      return next;
    });
  }, [commitBuffer]);

  const toggleTyping = useCallback(() => {
    haptics.selection();
    setTyping((wasTyping) => {
      if (!wasTyping) setBuffer(bufferFromHourMinute({ hour: curHour, minute: curMin }));
      return !wasTyping;
    });
  }, [curHour, curMin]);

  const itemHeight = t.size.wheelRow; // 32pt — tight rows, matches DurationWheel
  // Centre row + a half-row peek each side (scroll cue) — compact, not 3 full rows.
  const wheelHeight = itemHeight * (1 + 2 * WHEEL_SIDE_PEEK);
  const pad = itemHeight * WHEEL_SIDE_PEEK;

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

  const readoutText: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.honestHero, // 46
    letterSpacing: t.letterSpacing.tight,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };

  const readoutDisplay = typing ? formatBuffer(buffer) : `${pad2(curHour)}:${pad2(curMin)}`;

  const enter = FadeIn.duration(t.motion.fast).reduceMotion(ReduceMotion.System);

  const dualWheel = (
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
          accessibilityValue={curHour}
          reducedMotion={reducedMotion}
        />

        <Text style={separator}>:</Text>

        <ColumnWheel
          data={minutes}
          selectedIndex={mIdx}
          onIndexChange={handleMinuteChange}
          itemHeight={itemHeight}
          spring={t.motion.spring}
          inkColor={t.colors.ink}
          inkFaintColor={t.colors.inkFaint}
          fontSize={t.fontSize.base}
          accessibilityLabel="Minute"
          accessibilityMin={0}
          accessibilityMax={59}
          accessibilityValue={curMin}
          reducedMotion={reducedMotion}
        />
      </View>
    </View>
  );

  return (
    <View>
      {/* Mode chips */}
      {showModes ? (
        <View style={chipRow}>
          {MODES.map((m) => (
            <Chip key={m} label={m} selected={mode === m} onPress={() => handleModePress(m)} />
          ))}
        </View>
      ) : null}

      {/* Editable: tappable readout above the wheel/keypad */}
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit time, currently ${pad2(curHour)}:${pad2(curMin)}`}
          accessibilityHint={typing ? 'Show the time wheel' : 'Type an exact time'}
          onPress={toggleTyping}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: t.space[2],
              paddingVertical: t.space[6],
            }}
          >
            <Text style={readoutText}>{readoutDisplay}</Text>
            <Ionicons
              name={typing ? 'chevron-up' : 'keypad-outline'}
              size={t.iconSize.sm}
              color={t.colors.inkFaint}
            />
          </View>
        </Pressable>
      ) : null}

      {/* Wheel ⇄ keypad. entering-only crossfade (no exiting → no Fabric crash). */}
      {editable && typing ? (
        <Animated.View key="keypad" entering={enter}>
          <Keypad onDigit={handleDigit} onBackspace={handleBackspace} />
        </Animated.View>
      ) : (
        <Animated.View key="wheel" entering={editable ? enter : undefined}>
          {dualWheel}
        </Animated.View>
      )}
    </View>
  );
}

export type { DeadlineMode };
