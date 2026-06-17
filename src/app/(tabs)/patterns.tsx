import { ScrollView } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { usePatterns } from '@/src/features/patterns/usePatterns';
import { Archetype } from '@/src/features/patterns/Archetype';
import { PlanExperiment, PlanExperimentPending } from '@/src/features/patterns/PlanExperiment';
import { YouVsPast } from '@/src/features/patterns/YouVsPast';
import { BiggestSurprise } from '@/src/features/patterns/BiggestSurprise';
import { PredictionCard } from '@/src/features/patterns/PredictionCard';
import { DriftAlert } from '@/src/features/patterns/DriftAlert';
import { CalibrationMap } from '@/src/features/patterns/CalibrationMap';
import { PatternsEmpty } from '@/src/features/patterns/PatternsEmpty';
import { WeeklyReview } from '@/src/features/patterns/WeeklyReview';
import { useReasonInsights } from '@/src/features/patterns/useReasonInsights';
import { ProGate } from '@/src/features/paywall/ProGate';
import { StealsYourTime } from '@/src/features/patterns/StealsYourTime';
import { StealsYourTimeWeekly } from '@/src/features/patterns/StealsYourTimeWeekly';
import { StealsYourTimeLocked } from '@/src/features/patterns/StealsYourTimeLocked';
import { AccuracyCorrelations } from '@/src/features/patterns/AccuracyCorrelations';
import { AccuracyCorrelationsLocked } from '@/src/features/patterns/AccuracyCorrelationsLocked';
import { useContextInsights } from '@/src/features/patterns/useContextInsights';
import { ContextCorrelations } from '@/src/features/patterns/ContextCorrelations';
import { ContextCorrelationsLocked } from '@/src/features/patterns/ContextCorrelationsLocked';

// ──────────────────────────────────────────────────────────────────────────────
// Patterns — the free, read-only self-insight surface. Every card is a pure
// projection over the engine (see usePatterns). Cards hide until their data is
// earned; a brand-new user meets a calm empty state, never a wall of blanks. No
// guilt, no streaks, amber stays scarce. Order: who-you-are → the experiment →
// growth → the surprise → what-to-expect → what-changed → the map.
// ──────────────────────────────────────────────────────────────────────────────

export default function Patterns() {
  const t = useTheme();
  const { view } = usePatterns();
  const { insights } = useReasonInsights();
  const { insights: contextInsights } = useContextInsights();

  const showEmpty = view !== null && view.empty;
  // Plan-experiment is special: when there's enough overall data but the timed/retro
  // arms are too thin to compare, we show a calm "not yet" instead of hiding it.
  const showPlanPending = view !== null && !view.empty && view.planExperiment === null;

  return (
    <Screen>
      <ScreenHeader title="Patterns" subtitle="What your time has been telling you." />
      <ScrollView
        contentContainerStyle={{ gap: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        {showEmpty ? <PatternsEmpty /> : null}

        {view && !view.empty ? (
          <>
            <WeeklyReview view={view} />
            {view.archetype ? <Archetype card={view.archetype} /> : null}
            {view.planExperiment ? (
              <PlanExperiment card={view.planExperiment} />
            ) : showPlanPending ? (
              <PlanExperimentPending />
            ) : null}
            {view.youVsPast ? <YouVsPast card={view.youVsPast} /> : null}
            {view.biggestSurprise ? <BiggestSurprise card={view.biggestSurprise} /> : null}
            {view.prediction ? <PredictionCard card={view.prediction} /> : null}
            {view.driftAlert ? <DriftAlert card={view.driftAlert} /> : null}
            <ProGate fallback={insights.length > 0 ? <StealsYourTimeLocked /> : null}>
              <StealsYourTime insights={insights} />
              <StealsYourTimeWeekly insights={insights} />
            </ProGate>
            <ProGate
              fallback={view.accuracyCorrelations.length > 0 ? <AccuracyCorrelationsLocked /> : null}
            >
              {view.accuracyCorrelations.length > 0 ? (
                <AccuracyCorrelations correlations={view.accuracyCorrelations} />
              ) : null}
            </ProGate>
            <ProGate fallback={contextInsights.length > 0 ? <ContextCorrelationsLocked /> : null}>
              {contextInsights.length > 0 ? (
                <ContextCorrelations correlations={contextInsights} />
              ) : null}
            </ProGate>
            {view.calibrationMap.length > 0 ? <CalibrationMap rows={view.calibrationMap} /> : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
