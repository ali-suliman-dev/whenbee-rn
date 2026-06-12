import { useEffect } from 'react';
import { View, Pressable, Alert, type ViewStyle, type TextStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useTimer } from '@/src/features/timer/useTimer';
import { TimerRing } from '@/src/features/timer/TimerRing';
import { PaceLabel } from '@/src/features/timer/PaceLabel';
import { FinishTime } from '@/src/features/timer/FinishTime';

// ──────────────────────────────────────────────────────────────────────────────
// Live Timer (Screen 3) — calm focus ring; measures actual vs guess, reframes
// overrun as data (amber, never red). All ticking comes from useTimer's shared
// values; the screen never holds a per-second interval. THE ONE action: Stop & log.
//
// Route params: taskId?, label, category, estimateMin (honest suggestion the ring
// fills toward) and OPTIONAL guessMin (the original guess that drives calibration;
// falls back to estimateMin if Today/Add-Task didn't pass it).
// ──────────────────────────────────────────────────────────────────────────────

function num(v: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function str(v: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(v) ? v[0] : v;
  return raw != null && raw.length > 0 ? raw : fallback;
}

export default function Timer() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const params = useLocalSearchParams<{
    taskId?: string;
    label?: string;
    category?: string;
    estimateMin?: string;
    guessMin?: string;
    suggestedHonestMin?: string;
  }>();

  const estimateMin = num(params.estimateMin, 15);
  // guessMin drives calibration; fall back to the honest estimate if absent.
  const guessMin = num(params.guessMin, estimateMin);
  // suggestedHonestMin = the honest number the user SAW; defaults to estimateMin
  // (which IS the honest number from Today/Add-Task when not passed separately).
  const suggestedHonestMin = num(params.suggestedHonestMin, estimateMin);
  const label = str(params.label, 'Focus session');
  const category = str(params.category, 'getting_ready');
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;

  const timer = useTimer({ taskId, label, category, estimateMin, guessMin, suggestedHonestMin });

  // Pulsing indigo live dot (static under reduced motion).
  const pulse = useSharedValue(reducedMotion ? 1 : 0.4);
  useEffect(() => {
    if (reducedMotion) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: t.motion.pulse }),
        withTiming(0.4, { duration: t.motion.pulse }),
      ),
      -1,
      false,
    );
  }, [reducedMotion, pulse, t.motion.pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  function confirmAbandon() {
    Alert.alert(
      'Abandon this task?',
      'No guilt — it just won’t count toward your honey.',
      [
        { text: 'Keep timing', style: 'cancel' },
        { text: 'Abandon', style: 'destructive', onPress: () => void timer.onAbandon() },
      ],
    );
  }

  // ✕ MINIMIZES: close the sheet but keep the timer running. The ActiveTimerBar on
  // Today/Plan reopens the same session. A close control that destroyed the timer
  // would break the mental model — Abandon (with confirm) is the explicit teardown.
  function minimize() {
    router.dismiss();
  }

  // ── styles ──
  const topRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: t.space[2],
  };
  const closeBtn: ViewStyle = {
    width: t.size.control.sm,
    height: t.size.control.sm,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const liveDot: ViewStyle = {
    width: t.space[2],
    height: t.space[2],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };
  const eyebrowText: TextStyle = { ...(type.eyebrow as TextStyle), color: t.colors.inkSoft };
  const taskName: TextStyle = {
    ...(type.subtitle as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const controlsRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: t.space[4],
  };
  const spacer44: ViewStyle = { width: t.size.control.sm, height: t.size.control.sm };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Top row: ✕ · eyebrow · spacer */}
        <View style={topRow}>
          <Pressable
            onPress={minimize}
            accessibilityRole="button"
            accessibilityLabel="Minimize timer"
            style={closeBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-down" size={t.iconSize.md} color={t.colors.ink} />
          </Pressable>

          <View style={eyebrowRow}>
            <Animated.View style={[liveDot, dotStyle]} />
            <AppText style={eyebrowText}>Timing now</AppText>
          </View>

          <View style={spacer44} />
        </View>

        {/* Ring stage + anchors */}
        <View style={{ gap: t.space[5], alignItems: 'center' }}>
          <TimerRing
            elapsedSec={timer.elapsedSec}
            overProgress={timer.overProgress}
            milestoneLatch={timer.milestoneLatch}
            estimateSec={timer.estimateSec}
            guessMin={timer.guessMin}
          />

          <AppText style={taskName}>{label}</AppText>

          <PaceLabel elapsedSec={timer.elapsedSec} estimateSec={timer.estimateSec} />

          <FinishTime
            elapsedSec={timer.elapsedSec}
            estimateSec={timer.estimateSec}
            startedAt={timer.startedAt}
            startedClock={timer.startedClock}
            finishClock={timer.finishClock}
          />
        </View>

        {/* Controls: Cancel (ghost) · Stop & log (indigo primary) */}
        <View style={controlsRow}>
          <AppButton label="Cancel" variant="ghost" onPress={confirmAbandon} />
          <AppButton
            label="Stop & log"
            variant="indigo"
            onPress={() => void timer.onStopAndLog()}
          />
        </View>
      </View>
    </Screen>
  );
}
