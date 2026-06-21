import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// RoutineRunView — run a saved routine step-by-step on the shared rail. The
// current step carries a one-tap timer; finishing records its real minutes and
// advances. Skipping is first-class (no guilt, no red). Finishing the last step
// hands the run to the store (Task 4) which trains the chain. (Spec §5.3 / §10.)
// ──────────────────────────────────────────────────────────────────────────────

const MS_PER_MIN = 60_000;

/** Map a run step status to the rail node state (skipped reads as a quiet done). */
function railStateFor(status: RunStepStatus): RailNodeState {
  if (status === 'running') return 'now';
  if (status === 'done' || status === 'skipped') return 'done';
  return 'next';
}

export function RoutineRunView() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

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

  // A 1s tick to drive the live elapsed readout for the running step.
  const [, force] = useState(0);
  useEffect(() => {
    if (!runningId) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [runningId]);

  if (!activeRun || !routine) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: t.space[5] }}>
        <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
          Picked up where you stopped — nothing lost.
        </AppText>
      </View>
    );
  }

  const stepById = new Map(routine.steps.map((s) => [s.id, s]));
  const orderedRun = activeRun.steps;
  const total = orderedRun.length;
  const doneCount = orderedRun.filter((rs) => rs.status === 'done' || rs.status === 'skipped').length;
  const allResolved = orderedRun.every((rs) => rs.status === 'done' || rs.status === 'skipped');

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
            {doneCount} of {total} done
          </AppText>
        </View>
        <AppButton label="Stop" variant="ghost" size="xs" onPress={() => { void abandonRun(); }} />
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
                  category={step.category}
                  status={rs.status}
                  actualMin={rs.actualMin}
                  elapsedSec={rs.status === 'running' ? Math.floor((Date.now() - startRef.current.at) / 1000) : 0}
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
  elapsedSec,
  onDone,
  onSkip,
}: {
  label: string;
  category: string;
  status: RunStepStatus;
  actualMin?: number;
  elapsedSec: number;
  onDone: () => void;
  onSkip: () => void;
}) {
  const t = useTheme();
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
  const timer: TextStyle = { ...(type.timerClock as unknown as TextStyle), color: t.colors.ink };

  return (
    <View style={card}>
      <AppText style={titleStyle} numberOfLines={1}>{label}</AppText>
      <AppText style={catStyle} numberOfLines={1}>
        {category}
        {status === 'done' && actualMin !== undefined ? ` · ${actualMin}m` : ''}
        {status === 'skipped' ? ' · skipped' : ''}
      </AppText>
      {isNow ? (
        <>
          <AppText style={timer}>{formatMmSs(elapsedSec)}</AppText>
          <View style={{ flexDirection: 'row', gap: t.space[2] }}>
            <AppButton label="Done" variant="indigo" size="sm" onPress={onDone} />
            <AppButton label="Skip" variant="ghost" size="sm" onPress={onSkip} />
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

  // Ran long → the "Good to know" variant; on-time/short → "settling". No guilt
  // either way; amber accent only, never red. (Spec §10.)
  const ranLong = actualMin > honestMin;
  const text = ranLong
    ? `That run took ${actualMin} min. Good to know — I'll fold that into your ${name} so the next "start by" is more honest.`
    : `That run took ${actualMin} min. Your ${name} is settling — next time I'll expect about ${honestMin}.`;

  return (
    <View style={card}>
      <AppText style={body}>{text}</AppText>
      <AppButton label="Done" variant="indigo" fullWidth onPress={onFinish} />
    </View>
  );
}
