import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type ViewStyle, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { PlanRail } from '@/src/features/planner/PlanRail';
import type { RailNodeState } from '@/src/features/planner/RailNode';
import { formatMmSs } from '@/src/lib/time';
import { stepHonestMinutes, routineHonestTotal, priorFor } from '@/src/engine';
import { useRoutinesStore, type RunStepStatus } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { categoryName } from '@/src/features/shared/categoryName';
import { analytics } from '@/src/services/analytics';
import { haptics } from '@/src/lib/haptics';

// ──────────────────────────────────────────────────────────────────────────────
// RoutineRunView — guided run with a live COUNTDOWN per step.
//
// AUTO-ADVANCE RULE: when elapsed seconds reaches the step's honest estimate
// (honestMin × 60), the step auto-completes once (guarded by a per-step
// `advancedRef` so the interval never re-fires), a haptic fires as a gentle
// chime, and the next step starts. Manual Done (complete early) and Skip always
// work. Overrun is never punished: if the user keeps working past the estimate
// the countdown goes negative ("+2:10") and they can Done manually.
//
// LIVE ACTIVITY: startRun (store) already fires startFinishTimeActivity; this
// view calls endFinishTimeActivity via the store's finishRun/abandonRun.
//
// REDUCED-MOTION: when the system reduced-motion flag is on, the countdown still
// ticks (it is information, not decoration) but no haptic fires on auto-advance
// (the chime is purely tactile; we skip it out of respect for the accessibility
// preference). The step still auto-advances — only the haptic is suppressed.
// ──────────────────────────────────────────────────────────────────────────────

const MS_PER_MIN = 60_000;

/** Map a run step status to the rail node state (skipped reads as a quiet done). */
function railStateFor(status: RunStepStatus): RailNodeState {
  if (status === 'running') return 'now';
  if (status === 'done' || status === 'skipped') return 'done';
  return 'next';
}

/**
 * Format a signed remaining-seconds value for display.
 * Positive → MM:SS countdown. Zero/negative → "+MM:SS" overrun (calm, no guilt).
 */
function formatRemaining(remainingSec: number): string {
  if (remainingSec >= 0) return formatMmSs(remainingSec);
  return `+${formatMmSs(-remainingSec)}`;
}

export function RoutineRunView() {
  const t = useTheme();
  const { t: tr } = useTranslation('routines');
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const activeRun = useRoutinesStore((s) => s.activeRun);
  const routines = useRoutinesStore((s) => s.routines);
  const completeStep = useRoutinesStore((s) => s.completeStep);
  const skipStep = useRoutinesStore((s) => s.skipStep);
  const finishRun = useRoutinesStore((s) => s.finishRun);
  const abandonRun = useRoutinesStore((s) => s.abandonRun);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const routine = useMemo(
    () => routines.find((r) => r.routine.id === activeRun?.routineId) ?? null,
    [routines, activeRun?.routineId],
  );

  // The current step's wall-clock start, captured when it becomes 'running'.
  const runningId = activeRun?.steps.find((rs) => rs.status === 'running')?.stepId ?? null;
  const startRef = useRef<{ id: string | null; at: number }>({ id: null, at: Date.now() });
  if (startRef.current.id !== runningId) {
    startRef.current = { id: runningId, at: Date.now() };
  }

  // Guard: tracks whether the current running step has already auto-advanced.
  // Keyed by stepId so it resets automatically when the running step changes.
  const advancedRef = useRef<{ id: string | null; fired: boolean }>({ id: null, fired: false });
  if (advancedRef.current.id !== runningId) {
    advancedRef.current = { id: runningId, fired: false };
  }

  // A 1s tick to drive the live countdown readout AND auto-advance.
  // Auto-advance lives here (not in the render body) to avoid "Cannot update a
  // component while rendering" warnings — store setters must not be called during
  // render. The advancedRef guard ensures the advance fires exactly once per step.
  const [, force] = useState(0);
  useEffect(() => {
    if (!runningId) return;
    const id = setInterval(() => {
      force((n) => n + 1);

      // Auto-advance: check if the running step has reached its honest estimate.
      const state = useRoutinesStore.getState();
      const run = state.activeRun;
      if (!run) return;
      const runningStep = run.steps.find((rs) => rs.status === 'running');
      if (!runningStep) return;
      if (advancedRef.current.fired) return;

      // Get the routine definition to compute the honest seconds for this step.
      const routineEntry = state.routines.find((r) => r.routine.id === run.routineId);
      if (!routineEntry) return;
      const stepDef = routineEntry.steps.find((s) => s.id === runningStep.stepId);
      if (!stepDef) return;

      const calibStats = useCalibrationStore.getState().statsByCategory;
      const stepM = calibStats[stepDef.category]?.mEffective ?? priorFor(stepDef.category);
      const honestSec = Math.round(stepHonestMinutes(stepDef.guessMin, stepM) * 60);
      const stepElapsedSec = Math.max(
        0,
        Math.floor((Date.now() - startRef.current.at) / 1000),
      );

      if (stepElapsedSec >= honestSec) {
        advancedRef.current.fired = true;
        const actualMin = Math.max(1, Math.round((Date.now() - startRef.current.at) / MS_PER_MIN));
        analytics.capture('routine_step_completed', { position: run.steps.indexOf(runningStep), over: false });
        if (!reducedMotion) haptics.success();
        state.completeStep(runningStep.stepId, actualMin);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [runningId, reducedMotion]);

  if (!activeRun || !routine) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: t.space[5] }}>
        <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
          {tr('run.resumed')}
        </AppText>
      </View>
    );
  }

  const stepById = new Map(routine.steps.map((s) => [s.id, s]));
  const orderedRun = activeRun.steps;
  const total = orderedRun.length;
  const doneCount = orderedRun.filter((rs) => rs.status === 'done' || rs.status === 'skipped').length;
  const allResolved = orderedRun.every((rs) => rs.status === 'done' || rs.status === 'skipped');

  const elapsedSec = (): number => Math.max(0, Math.floor((Date.now() - startRef.current.at) / 1000));
  const elapsedMin = (): number => Math.max(0, (Date.now() - startRef.current.at) / MS_PER_MIN);

  const handleDone = (id: string, position: number) => {
    const min = Math.max(1, Math.round(elapsedMin()));
    const step = stepById.get(id);
    const over = step ? min > step.guessMin : false;
    analytics.capture('routine_step_completed', { position, over });
    completeStep(id, min);
  };

  const handleSkip = (id: string, position: number) => {
    analytics.capture('routine_step_skipped', { position });
    skipStep(id);
  };

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const headerMeta: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const row: ViewStyle = { flexDirection: 'row', columnGap: t.space[2], alignItems: 'stretch' };
  const cardCol: ViewStyle = { flex: 1, minWidth: 0, paddingVertical: t.space[1.5] };

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: t.space[3], paddingBottom: insets.bottom + t.space[8] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.space[3] }}>
        <View>
          <AppText style={header}>{routine.routine.name}</AppText>
          <AppText style={headerMeta}>
            {tr('run.progress', { done: doneCount, total })}
          </AppText>
        </View>
        <AppButton
          label={tr('run.stop')}
          variant="ghost"
          size="xs"
          onPress={() => { void abandonRun(); }}
          accessibilityLabel={tr('run.stopA11y')}
          accessibilityHint={tr('run.stopHintA11y')}
        />
      </View>

      {allResolved ? (
        <RunRecap
          name={routine.routine.name}
          actualMin={orderedRun.reduce((sum, rs) => sum + (rs.actualMin ?? 0), 0)}
          honestMin={routineHonestTotal(
            routine.steps.map((s) =>
              stepHonestMinutes(s.guessMin, statsByCategory[s.category]?.mEffective ?? priorFor(s.category)),
            ),
            routine.routine.transitionFactor,
          )}
          onFinish={() => { void finishRun(); }}
        />
      ) : (
        orderedRun.map((rs, i) => {
          const step = stepById.get(rs.stepId);
          if (!step) return null;
          const prev = i > 0 ? railStateFor(orderedRun[i - 1]!.status) : undefined;

          // Compute per-step honest seconds for the countdown target.
          const stepM = statsByCategory[step.category]?.mEffective ?? priorFor(step.category);
          const honestMin = stepHonestMinutes(step.guessMin, stepM);
          const honestSec = Math.round(honestMin * 60);

          // Elapsed seconds for this step (0 when not running).
          const stepElapsedSec = rs.status === 'running' ? elapsedSec() : 0;
          const remainingSec = honestSec - stepElapsedSec;

          return (
            <View key={rs.stepId} style={row}>
              <PlanRail
                state={railStateFor(rs.status)}
                showNowPill={rs.status === 'running'}
                isFirst={i === 0}
                isLast={i === orderedRun.length - 1}
                prevState={prev}
              />
              <View style={cardCol}>
                <StepCard
                  label={step.label}
                  category={categoryName(step.category)}
                  status={rs.status}
                  actualMin={rs.actualMin}
                  remainingSec={remainingSec}
                  isOverrun={rs.status === 'running' && remainingSec < 0}
                  onDone={() => handleDone(rs.stepId, i)}
                  onSkip={() => handleSkip(rs.stepId, i)}
                />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function StepCard({
  label,
  category,
  status,
  actualMin,
  remainingSec,
  isOverrun,
  onDone,
  onSkip,
}: {
  label: string;
  category: string;
  status: RunStepStatus;
  actualMin?: number;
  remainingSec: number;
  isOverrun: boolean;
  onDone: () => void;
  onSkip: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('routines');
  const isNow = status === 'running';

  const card: ViewStyle = {
    backgroundColor: isNow ? t.colors.surfaceRaised : t.colors.surface,
    borderWidth: isNow ? t.borderWidth.thick : t.borderWidth.card,
    borderColor: isNow ? t.colors.primary : t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[3],
    gap: t.space[2],
    opacity: status === 'done' || status === 'skipped' ? t.opacity.disabled : 1,
  };
  const titleStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.ink,
    textDecorationLine: status === 'skipped' ? 'line-through' : 'none',
  };
  const catStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  // Overrun: amber accent (never red — no guilt). Normal countdown: ink.
  const timerStyle: TextStyle = {
    ...(type.timerClock as unknown as TextStyle),
    color: isOverrun ? t.colors.accent : t.colors.ink,
  };

  return (
    <View style={card}>
      <AppText style={titleStyle} numberOfLines={1}>{label}</AppText>
      <AppText style={catStyle} numberOfLines={1}>
        {category}
        {status === 'done' && actualMin !== undefined ? ` · ${tr('run.actualMinutes', { count: actualMin })}` : ''}
        {status === 'skipped' ? ` · ${tr('run.skippedMeta')}` : ''}
      </AppText>
      {isNow ? (
        <>
          <AppText
            style={timerStyle}
            accessibilityLabel={
              remainingSec >= 0
                ? tr('run.remainingA11y', { min: Math.floor(remainingSec / 60), sec: remainingSec % 60 })
                : tr('run.overA11y', { min: Math.floor(-remainingSec / 60), sec: (-remainingSec) % 60 })
            }
            accessibilityLiveRegion="polite"
          >
            {formatRemaining(remainingSec)}
          </AppText>
          <View style={{ flexDirection: 'row', gap: t.space[2] }}>
            <AppButton
              label={tr('run.done')}
              variant="indigo"
              size="sm"
              onPress={onDone}
              accessibilityLabel={tr('run.doneStepA11y')}
              accessibilityHint={tr('run.doneStepHintA11y')}
            />
            <AppButton
              label={tr('run.skip')}
              variant="ghost"
              size="sm"
              onPress={onSkip}
              accessibilityLabel={tr('run.skipA11y')}
              accessibilityHint={tr('run.skipHintA11y')}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

function RunRecap({
  name,
  actualMin,
  honestMin,
  onFinish,
}: {
  name: string;
  actualMin: number;
  honestMin: number;
  onFinish: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('routines');
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
  };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.ink };

  // Ran long → calibration learn copy; on-time/short → reinforcing copy. No guilt
  // either way — amber accent only, never red. (Spec §10.)
  const ranLong = actualMin > honestMin;
  const text = ranLong
    ? tr('run.recapLong', { name, actual: actualMin })
    : tr('run.recapOnTime', { name, actual: actualMin });

  return (
    <View style={card}>
      <AppText style={body}>{text}</AppText>
      <AppButton label={tr('run.done')} variant="indigo" fullWidth onPress={onFinish} />
    </View>
  );
}
