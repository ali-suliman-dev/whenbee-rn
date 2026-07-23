import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { formatClock } from '@/src/lib/time';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';
import { useForgotStore } from '@/src/stores/forgotStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { usePlanStore } from '@/src/stores/planStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import type { AdaptSpeed, LogStatus } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ForgotCard — recovery card for a session `useForgotCheck` auto-closed while the
// user was away. Renders as a real overlay: a cool, blue-leaning dim behind an
// elevated (surfaceRaised) card so it reads as a focal modal, not a card floating
// on Today. No top accent border — the amber lives only on the primary action.
//
// Two modes:
//  • choices — one-tap presets, each button stating exactly what it logs.
//  • picker  — a time wheel to dial the real finish; the confirm button shows the
//    minutes it will log before you commit (replaces the old, silent
//    "A few minutes ago" that logged elapsed−5 with no confirmation).
//
// Confirm writes a completed retro log (trains at half weight via `source:'retro'`);
// "Still going" reopens the session with no log; "Not sure yet" writes a partial
// record that never trains. No guilt anywhere — this reads as help, not a correction.
//
// Motion: opacity-only FadeIn (no slide/bounce, per the animation hard rule).
// Reduced-motion renders the final state directly.
// ──────────────────────────────────────────────────────────────────────────────

export function ForgotCard(): React.JSX.Element | null {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const pending = useForgotStore((s) => s.pending);
  const clear = useForgotStore((s) => s.clear);

  const [mode, setMode] = useState<'choices' | 'picker'>('choices');
  const [pickedMs, setPickedMs] = useState<number | null>(null);

  // Each fresh card opens on the choices — reset when a new pending arrives.
  useEffect(() => {
    if (pending !== null) {
      setMode('choices');
      setPickedMs(null);
    }
  }, [pending]);

  const write = useCallback(
    async (actualMin: number, status: LogStatus) => {
      if (pending === null) return;
      const adaptSpeed: AdaptSpeed =
        useCategoriesStore.getState().categories.find((c) => c.id === pending.category)
          ?.adaptSpeed ?? 'balanced';
      await useCalibrationStore.getState().applyLog({
        category: pending.category,
        estimateMin: pending.guessMin,
        actualMin,
        status,
        source: 'retro',
        adaptSpeed,
        label: pending.taskLabel,
        suggestedHonestMin: pending.honestMin,
        startedAt: null,
      });
      // A completed retro must also flip Today + plan bookkeeping — same tail as
      // every other completed stop (useTimer.logCompletedAndReward,
      // stopPresenceSessionAndLog). Without it the linked task stays queued and
      // rolls forward as still-to-do. Partial ("Not sure yet") never marks done.
      if (status === 'completed' && pending.taskId !== null) {
        const taskId = pending.taskId;
        useDayTasksStore.getState().completeTask(taskId, { completedAt: Date.now(), actualMin });
        void useDayTasksStore.getState().reload();
        const planActive = usePlanStore.getState().active;
        if (planActive !== null) {
          const planTask = planActive.tasks.find((pt) => pt.id === taskId);
          if (planTask?.status === 'running') usePlanStore.getState().completeTask(taskId, actualMin);
        }
      }
      useSettingsStore.getState().markForgotProtectSeen();
      clear();
    },
    [pending, clear],
  );

  const stillGoing = useCallback(() => {
    if (pending === null) return;
    haptics.selection();
    useTimerStore.getState().reopen({
      taskLabel: pending.taskLabel,
      category: pending.category,
      estimateMin: pending.estimateMin,
      startedAt: pending.startedAt,
      guessMin: pending.guessMin,
      taskId: pending.taskId,
      suggestedHonestMin: pending.honestMin,
      isQuickStart: false,
      pausedAccumMs: pending.pausedAccumMs,
    });
    useSettingsStore.getState().markForgotProtectSeen();
    clear();
  }, [pending, clear]);

  if (pending === null) return null;

  const seen = useSettingsStore.getState().forgotProtectSeen;

  // Picker: default the wheel to the predicted honest finish, rounded to the
  // wheel's 5-min step so the readout and the confirm button agree before any
  // scroll. Derive the minutes any chosen clock time would log (clamped to ≥1,
  // never a runaway or a negative).
  const nowMs = Date.now();
  const stepMs = 5 * 60_000;
  const defaultFinishMs =
    Math.round((pending.startedAt + Math.max(1, pending.honestMin) * 60_000) / stepMs) * stepMs;
  const finishMs = pickedMs ?? defaultFinishMs;
  // Belt-and-suspenders: the wheel is now bounded to [startedAt, now] and can't
  // emit outside it, but keep the parent clamp so the logged minutes never run
  // past the present even if a caller passes an odd value.
  const clampedFinishMs = Math.min(nowMs, Math.max(pending.startedAt, finishMs));
  const pickedActualMin = Math.max(1, Math.round((clampedFinishMs - pending.startedAt) / 60_000));

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const card: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised, // lifts clearly off the near-black bg
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    padding: t.space[5],
    gap: t.space[4],
  };
  const heading: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const skip: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };
  const wheelWrap: ViewStyle = { paddingVertical: t.space[2] };

  const enter = reducedMotion ? undefined : FadeIn.duration(t.motion.base);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Cool blue-leaning dim — blocks the background so the card reads as modal. */}
      <Animated.View
        entering={enter}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: t.colors.scrimOverlay }]}
      />
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          paddingBottom: insets.bottom + t.space[4],
          paddingHorizontal: t.space[4],
        }}
      >
        <Animated.View
          entering={enter}
          style={card}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          {mode === 'choices' ? (
            <>
              <AppText style={heading}>{`Wrapped up "${pending.taskLabel}" while you were away`}</AppText>
              <AppText style={body}>
                {seen
                  ? 'It ran past your honest finish, so I paused it. When did you actually stop?'
                  : 'It ran well past your estimate, so I paused it. When did you actually stop? You can change when I step in from Settings.'}
              </AppText>
              <View style={{ gap: t.space[2.5] }}>
                <AppButton
                  label={`Log honest finish · ${pending.recoveredActualMin}m`}
                  variant="amber"
                  size="md"
                  fullWidth
                  onPress={() => {
                    haptics.selection();
                    void write(pending.recoveredActualMin, 'completed');
                  }}
                />
                <AppButton
                  label={`Log your first guess · ${pending.guessMin}m`}
                  variant="ghost"
                  size="md"
                  fullWidth
                  onPress={() => {
                    haptics.selection();
                    void write(pending.guessMin, 'completed');
                  }}
                />
                <AppButton
                  label="Pick the exact time"
                  variant="ghost"
                  size="md"
                  fullWidth
                  onPress={() => {
                    haptics.light();
                    setMode('picker');
                  }}
                />
              </View>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.hairline }} />
              <View style={{ flexDirection: 'row', gap: t.space[2.5] }}>
                <View style={{ flex: 1 }}>
                  <AppButton label="Still going" variant="ghost" size="md" fullWidth onPress={stillGoing} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Not sure yet — skip logging this session"
                  onPress={() => void write(pending.recoveredActualMin, 'partial')}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AppText style={skip}>Not sure yet</AppText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <AppText style={heading}>When did you finish?</AppText>
              <AppText style={body}>Spin to the time you actually stopped.</AppText>
              <View style={wheelWrap}>
                <FinishTimeWheel
                  valueMs={clampedFinishMs}
                  mode="be done by"
                  showModes={false}
                  minMs={pending.startedAt}
                  maxMs={nowMs}
                  onChange={(ms) => setPickedMs(ms)}
                />
              </View>
              <AppButton
                label={`Log ${formatClock(clampedFinishMs)} · ${pickedActualMin}m`}
                variant="amber"
                size="md"
                fullWidth
                onPress={() => {
                  haptics.selection();
                  void write(pickedActualMin, 'completed');
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to the quick options"
                onPress={() => {
                  haptics.light();
                  setMode('choices');
                }}
                style={{ alignItems: 'center', justifyContent: 'center', paddingTop: t.space[1] }}
              >
                <AppText style={skip}>Back</AppText>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
