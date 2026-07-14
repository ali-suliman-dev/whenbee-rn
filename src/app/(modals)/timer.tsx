import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, Alert, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useTimer } from '@/src/features/timer/useTimer';
import { TimerRing } from '@/src/features/timer/TimerRing';
import { PaceLabel } from '@/src/features/timer/PaceLabel';
import { FinishTime } from '@/src/features/timer/FinishTime';
import { InfoRow, LedgerValue } from '@/src/features/timer/InfoRow';
import { GuardrailCheckIn } from '@/src/features/timer/GuardrailCheckIn';
import { PostStopCaptureSheet } from '@/src/components/quick/PostStopCaptureSheet';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { usePickerCategories } from '@/src/features/shared/CategoryChips';
import { useTimerStore } from '@/src/stores/timerStore';
import { resolveTimerRoute } from '@/src/features/timer/resolveTimerRoute';
import type { ResolvedTimerRoute, TimerSessionParams } from '@/src/features/timer/resolveTimerRoute';
import { handlePresenceStop } from '@/src/features/timer/stopPresenceSession';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

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

export default function Timer() {
  const { action } = useLocalSearchParams<{ action?: string }>();
  // Presence "Stop & log" + guardrail "Wrap up" open this route with action=stop.
  // They carry NO session context, so the stop must run off the STORE — and must
  // NOT mount TimerScreen/useTimer, which (with empty params) would restart a fresh
  // session and log ~0 elapsed against the wrong category. Route to a bare handler.
  if (action === 'stop') return <PresenceStopHandler />;
  return <TimerGate />;
}

// Decides WHAT session the screen mounts with (attach to the running store
// session vs start fresh from the route params vs redirect) — see
// resolveTimerRoute for the contract. A bare deep link (presence-notification
// body tap, widget, quick chips) must attach to the running session, never
// restart it with placeholder params.
function TimerGate() {
  const t = useTheme();
  const params = useLocalSearchParams<{
    taskId?: string;
    label?: string;
    category?: string;
    estimateMin?: string;
    guessMin?: string;
    suggestedHonestMin?: string;
    quick?: string;
  }>();
  // Cold boot from a deep link: child screens mount BEFORE the root layout's
  // resumeFromKv effect runs, so a session that survived a kill is still KV-only.
  // Restore it in an effect (a store write during render would update components
  // mounted underneath, which React forbids), showing one blank frame.
  const [hydrated, setHydrated] = useState(
    () => useTimerStore.getState().isRunning || useTimerStore.getState().peekPersisted() === null,
  );
  useEffect(() => {
    if (hydrated) return;
    if (!useTimerStore.getState().isRunning) useTimerStore.getState().resumeFromKv();
    setHydrated(true);
  }, [hydrated]);

  // Freeze the decision at the first hydrated render — the screen must not
  // remount with different params when the store clears on stop/abandon.
  const resolvedRef = useRef<ResolvedTimerRoute | null>(null);
  if (hydrated && resolvedRef.current === null) {
    resolvedRef.current = resolveTimerRoute(params, useTimerStore.getState());
  }
  const resolved = resolvedRef.current;

  if (resolved === null) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;
  if (resolved.kind === 'redirect-today') return <Redirect href="/(tabs)" />;
  return <TimerScreen session={resolved.session} />;
}

// Bare handler for the presence stop action: no ring, no useTimer. Waits for the
// store session (restoring from KV on cold boot), stops + logs it from store
// context, then routes to the reward / capture as appropriate.
function PresenceStopHandler() {
  const t = useTheme();
  const isRunning = useTimerStore((s) => s.isRunning);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    // Cold boot: the running session is in KV, not memory yet — restore it.
    if (!useTimerStore.getState().isRunning) useTimerStore.getState().resumeFromKv();
    const s = useTimerStore.getState();
    if (!s.isRunning || s.startedAt === null) {
      // Stale notification — the session already ended, nothing to stop. Land on
      // Today instead of stranding the user on this blank screen.
      doneRef.current = true;
      router.replace('/(tabs)');
      return;
    }
    doneRef.current = true;
    void handlePresenceStop();
  }, [isRunning]);

  return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;
}

function TimerScreen({ session }: { session: TimerSessionParams }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // Everything session-shaped was resolved by TimerGate (attach-from-store vs
  // fresh-from-params); this screen just runs it. isQuickNav means quickStart()
  // already put an isRunning quick session in the store — do not overwrite it.
  const { taskId, label, category, estimateMin, guessMin, suggestedHonestMin, isQuickNav } = session;
  const timer = useTimer({ taskId, label, category, estimateMin, guessMin, suggestedHonestMin, isQuickNav });
  // Pro gates Surface C — the honest finish RANGE. Free keeps the point finish.
  const isPro = useEntitlement((s) => s.isPro);

  // ── Quick-start capture sheet state ─────────────────────────────────────
  // Shown after the user taps Stop on a quick-start session (no category yet).
  // The sheet lets them name + categorise before the log is written.
  const [showCaptureSheet, setShowCaptureSheet] = useState(false);
  const [capturedLabel, setCapturedLabel] = useState('');
  const categories = usePickerCategories();
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const learned = useVocabStore((s) => s.map);
  const bankVocab = useVocabStore((s) => s.bank);
  // Flips once the user taps a chip — from then on typing no longer re-guesses,
  // so a manual pick is never silently overwritten (mirrors the Add-Task sheet).
  const manualCatRef = useRef(false);

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

  // Re-guess the category live as the user types in the capture sheet — the same
  // smart categorizer the Add-Task sheet uses (learned picks → custom names →
  // built-in keywords). A manual chip tap (manualCatRef) freezes it.
  const onCapturedLabelChange = useCallback(
    (s: string) => {
      setCapturedLabel(s);
      if (manualCatRef.current) return;
      const g = guessCategory(s, {
        learned,
        namedCats: categories,
        availableIds: categories.map((c) => c.id),
      });
      if (g) setCapturedCategory(g);
    },
    [learned, categories],
  );

  const onCapturedCategoryChange = useCallback((id: string) => {
    manualCatRef.current = true;
    setCapturedCategory(id);
  }, []);

  const handleStopPress = useCallback(() => {
    if (timer.isQuickStart) {
      // Freeze the clock immediately so actualMin is anchored to now.
      timer.onFreezeForCapture();
      // Seed category from the label if typed; else most-frequent. Re-arm
      // auto-guessing for this capture (the user may not have typed yet).
      manualCatRef.current = false;
      const guessed = capturedLabel.trim()
        ? guessCategory(capturedLabel, {
            learned,
            namedCats: categories,
            availableIds: categories.map((c) => c.id),
          })
        : null;
      setCapturedCategory(guessed ?? pickDefaultCategory());
      setShowCaptureSheet(true);
    } else {
      void timer.onStopAndLog();
    }
  }, [timer, capturedLabel, categories, learned, pickDefaultCategory]);

  const handleCaptureSave = useCallback(async () => {
    // Pass label + category directly as overrides — the store is already cleared by
    // onFreezeForCapture at this point; overrides bypass the cleared state entirely.
    const finalLabel = capturedLabel.trim() || 'Focus session';
    const finalCategory = capturedCategory ?? categories[0]?.id ?? 'admin';
    // Teach the categorizer this title→category link so future guesses sharpen.
    if (capturedLabel.trim()) bankVocab(capturedLabel.trim(), finalCategory);
    setShowCaptureSheet(false);
    await timer.onStopAndLog(finalLabel, finalCategory);
  }, [capturedLabel, capturedCategory, categories, bankVocab, timer]);

  const handleCaptureSkip = useCallback(async () => {
    setShowCaptureSheet(false);
    await timer.onAbandon();
  }, [timer]);
  // ──────────────────────────────────────────────────────────────────────────

  // Pulsing indigo live dot (static under reduced motion).
  const pulse = useSharedValue(reducedMotion ? 1 : 0.4);
  useAmbientMotion(
    !reducedMotion,
    useCallback(() => {
      pulse.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: t.motion.pulse }),
            withTiming(0.4, { duration: t.motion.pulse }),
          ),
          -1,
          false,
        ),
      );
      return () => {
        cancelAnimation(pulse);
        pulse.set(1);
      };
    }, [pulse, t.motion.pulse]),
  );
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

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

  // Task title — bonded directly under the ring, then the info-row ledger below it.
  const taskName: TextStyle = {
    ...(type.subtitle as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
    marginTop: t.space[2.5],
  };
  const ledger: ViewStyle = { width: '100%', marginTop: t.space[8] };

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
    // Drawer sits below the status bar — drop the top inset so the timer doesn't
    // get a large empty gap above the ✕/controls on Android.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height, so space-between can't push the controls to the bottom (they'd
          float mid-sheet with dead space below). Anchor the column to the sheet's
          own height (0.95 detent) so the ring centres and the controls pin low. */}
      <View style={{ minHeight: winH * 0.95 - insets.bottom, flex: 1, justifyContent: 'space-between' }}>
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

        {/* Middle: ring · title · info-row ledger */}
        <View style={{ alignItems: 'center' }}>
          <TimerRing
            elapsedSec={timer.elapsedSec}
            overProgress={timer.overProgress}
            estimateSec={timer.estimateSec}
            guessMin={guessMin}
          />

          <AppText style={taskName}>{label}</AppText>

          <View style={ledger}>
            <InfoRow first label="Your guess">
              <LedgerValue>{guessRounded}m</LedgerValue>
            </InfoRow>
            <InfoRow label="Honest">
              <LedgerValue amber>~{honestRounded}m</LedgerValue>
            </InfoRow>
            <FinishTime
              elapsedSec={timer.elapsedSec}
              estimateSec={timer.estimateSec}
              startedAt={timer.startedAt}
              startedClock={timer.startedClock}
              finishClock={timer.finishClock}
              range={timer.range}
              confidence={timer.confidence}
              isPro={isPro}
            />
          </View>
        </View>

        {/* Bottom: pace pill · controls (✕ Abandon disc · Stop & log).
            Screen only insets top/left/right, so the footer adds the home-indicator
            inset itself — otherwise the buttons sit under it and can't be pressed.
            While the guardrail check-in is up, the controls dim (never disappear) so
            focus shifts to the card; the ring stays live and readable above. */}
        <View
          style={{
            gap: t.space[4],
            paddingBottom: insets.bottom + t.space[2],
            opacity: timer.guardDue ? t.opacity.pressed : 1,
          }}
          pointerEvents={timer.guardDue ? 'none' : 'auto'}
        >
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
            onLabelChange={onCapturedLabelChange}
            category={capturedCategory}
            onCategoryChange={onCapturedCategoryChange}
            onSave={() => void handleCaptureSave()}
            onSkip={() => void handleCaptureSkip()}
          />
        ) : null}

        {/* Hyperfocus guardrail check-in (Pro, opt-in) — a calm amber panel pinned to
            the bottom over the dimmed controls. The ring stays readable above. Mounted
            only while due; entering-only motion drives the dismiss internally. */}
        {timer.guardDue ? (
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
            pointerEvents="box-none"
          >
            <GuardrailCheckIn
              taskLabel={label}
              elapsedMin={Math.max(0, Math.floor((Date.now() - timer.startedAt) / 60000))}
              bottomInset={insets.bottom}
              onKeepGoing={timer.keepGoing}
              onWrapUp={() => void timer.wrapUp()}
            />
          </View>
        ) : null}
    </Screen>
  );
}
