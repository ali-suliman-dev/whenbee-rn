import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, Alert, type ViewStyle, type TextStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { PostStopCaptureSheet } from '@/src/components/quick/PostStopCaptureSheet';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { usePickerCategories } from '@/src/features/shared/CategoryChips';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// Live Timer (Screen 3) — calm focus ring; measures actual vs guess, reframes
// overrun as data (amber, never red). All ticking comes from useTimer's shared
// values; the screen never holds a per-second interval. THE ONE action: Stop & log.
//
// Layout: ring + guess→honest reframe + task/finish are the centered middle; the
// pace pill and the controls (✕ Abandon disc · Stop & log) are pinned to the
// bottom. The honest number is amber — it's the optimistic real target (honey
// semantic), and on overrun the whole frame warms to amber together.
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
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const params = useLocalSearchParams<{
    taskId?: string;
    label?: string;
    category?: string;
    estimateMin?: string;
    guessMin?: string;
    suggestedHonestMin?: string;
    quick?: string;
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

  // quick='1' signals that quickStart() was already called before navigation;
  // the store has an isRunning quick-start session that should not be overwritten.
  const isQuickNav = params.quick === '1';
  const timer = useTimer({ taskId, label, category, estimateMin, guessMin, suggestedHonestMin, isQuickNav });

  // ── Quick-start capture sheet state ─────────────────────────────────────
  // Shown after the user taps Stop on a quick-start session (no category yet).
  // The sheet lets them name + categorise before the log is written.
  const [showCaptureSheet, setShowCaptureSheet] = useState(false);
  const [capturedLabel, setCapturedLabel] = useState('');
  const categories = usePickerCategories();
  const stats = useCalibrationStore((s) => s.statsByCategory);

  // Pre-select most-frequent category (by log count from calibration stats).
  // Wrapped in useCallback so handleStopPress can list it in deps without a
  // stale-closure risk (stats changes → new reference → handleStopPress refreshes).
  const pickDefaultCategory = useCallback((): string | null => {
    let bestId: string | null = null;
    let bestN = 0;
    for (const [id, stat] of Object.entries(stats)) {
      if (stat.n > bestN) {
        bestN = stat.n;
        bestId = id;
      }
    }
    return bestId;
  }, [stats]);

  const [capturedCategory, setCapturedCategory] = useState<string | null>(null);

  const handleStopPress = useCallback(() => {
    if (timer.isQuickStart) {
      // Freeze the clock immediately so actualMin is anchored to now.
      timer.onFreezeForCapture();
      // Seed category from the label if typed; else most-frequent.
      const availableIds = categories.map((c) => c.id);
      const guessed = capturedLabel.trim()
        ? guessCategory(capturedLabel, { availableIds })
        : null;
      setCapturedCategory(guessed ?? pickDefaultCategory());
      setShowCaptureSheet(true);
    } else {
      void timer.onStopAndLog();
    }
  }, [timer, capturedLabel, categories, pickDefaultCategory]);

  const handleCaptureSave = useCallback(async () => {
    // Pass label + category directly as overrides — the store is already cleared by
    // onFreezeForCapture at this point; overrides bypass the cleared state entirely.
    const finalLabel = capturedLabel.trim() || 'Focus session';
    const finalCategory = capturedCategory ?? categories[0]?.id ?? 'admin';
    setShowCaptureSheet(false);
    await timer.onStopAndLog(finalLabel, finalCategory);
  }, [capturedLabel, capturedCategory, categories, timer]);

  const handleCaptureSkip = useCallback(async () => {
    setShowCaptureSheet(false);
    await timer.onAbandon();
  }, [timer]);
  // ──────────────────────────────────────────────────────────────────────────

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

  const guessRounded = Math.round(guessMin);
  const honestRounded = Math.round(estimateMin);

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

  // guess → honest reframe (honest number in amber — the optimistic real target).
  const reframeRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: t.space[1.5],
    marginTop: t.space[4],
  };
  const reframeStrong: TextStyle = { ...(type.bodySm as TextStyle), color: t.colors.ink };
  const reframeSoft: TextStyle = { ...(type.bodySm as TextStyle), color: t.colors.inkSoft };
  const reframeHonest: TextStyle = { ...(type.bodySm as TextStyle), color: t.colors.accent };

  const taskBlock: ViewStyle = { alignItems: 'center', gap: t.space[2], marginTop: t.space[6] };
  const taskName: TextStyle = {
    ...(type.subtitle as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };

  const abandonBtn: ViewStyle = {
    width: t.size.control.lg,
    height: t.size.control.lg,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const controlsRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Top row: ✕ minimize · eyebrow · spacer */}
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

          <View style={{ width: t.size.control.sm, height: t.size.control.sm }} />
        </View>

        {/* Middle: ring · reframe · task/finish */}
        <View style={{ alignItems: 'center' }}>
          <TimerRing
            elapsedSec={timer.elapsedSec}
            overProgress={timer.overProgress}
            estimateSec={timer.estimateSec}
            guessMin={timer.guessMin}
          />

          <View style={reframeRow}>
            <AppText style={reframeStrong}>guessed {guessRounded}m</AppText>
            <AppText style={reframeSoft}>→</AppText>
            <AppText style={reframeSoft}>honest</AppText>
            <AppText style={reframeHonest}>~{honestRounded}m</AppText>
          </View>

          <View style={taskBlock}>
            <AppText style={taskName}>{label}</AppText>
            <FinishTime
              elapsedSec={timer.elapsedSec}
              estimateSec={timer.estimateSec}
              startedAt={timer.startedAt}
              startedClock={timer.startedClock}
              finishClock={timer.finishClock}
            />
          </View>
        </View>

        {/* Bottom: pace pill · controls (✕ Abandon disc · Stop & log).
            Screen only insets top/left/right, so the footer adds the home-indicator
            inset itself — otherwise the buttons sit under it and can't be pressed. */}
        <View style={{ gap: t.space[4], paddingBottom: insets.bottom + t.space[2] }}>
          <PaceLabel elapsedSec={timer.elapsedSec} estimateSec={timer.estimateSec} />

          <View style={controlsRow}>
            <Pressable
              onPress={confirmAbandon}
              accessibilityRole="button"
              accessibilityLabel="Abandon task"
              style={abandonBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={t.iconSize.md} color={t.colors.inkSoft} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <AppButton
                label="Stop & log"
                variant="indigo"
                size="md"
                fullWidth
                onPress={handleStopPress}
                icon={<Ionicons name="stop" size={t.iconSize.sm} color={t.colors.onIndigo} />}
              />
            </View>
          </View>
        </View>
      </View>
        {/* Post-stop capture sheet (quick-start sessions only).
            Mounted/unmounted conditionally — entering-only animation avoids
            Fabric SIGABRT on exiting prop with conditional unmount. */}
        {showCaptureSheet ? (
          <PostStopCaptureSheet
            label={capturedLabel}
            onLabelChange={setCapturedLabel}
            category={capturedCategory}
            onCategoryChange={setCapturedCategory}
            onSave={() => void handleCaptureSave()}
            onSkip={() => void handleCaptureSkip()}
          />
        ) : null}
    </Screen>
  );
}
