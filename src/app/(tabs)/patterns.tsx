import { ScrollView } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { usePatterns } from '@/src/features/patterns/usePatterns';
import { ArchetypeHero } from '@/src/features/patterns/Archetype';
import { ProgressChart } from '@/src/features/patterns/ProgressChart';
import { PlanExperiment } from '@/src/features/patterns/PlanExperiment';
import { BiggestSurprise } from '@/src/features/patterns/BiggestSurprise';
import { DriftNote } from '@/src/features/patterns/DriftAlert';
import { HonestMap } from '@/src/features/patterns/CalibrationMap';
import { SectionHeader } from '@/src/features/patterns/SectionHeader';
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
// Patterns — the free, read-only self-insight surface, redesigned as a hero +
// sectioned story: identity (ArchetypeHero) → progress (ProgressChart) → what
// changed (DriftNote / surprise) → your numbers (HonestMap) → Pro (one premium
// teaser). Every block is a pure projection over the engine (usePatterns) and
// hides until earned. Sections rise + stagger on entry (entering-only on Fabric;
// reduced-motion skips the transform). No guilt, no streaks, amber stays scarce.
// ──────────────────────────────────────────────────────────────────────────────

export default function Patterns() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const { view } = usePatterns();
  const { insights } = useReasonInsights();
  const { insights: contextInsights } = useContextInsights();

  const showEmpty = view !== null && view.empty;

  // Per-section entrance: rise + fade, staggered top→bottom (< 500ms total).
  let order = 0;
  const rise = () => (reduced ? undefined : FadeInDown.duration(t.motion.base).delay((order++) * t.motion.enterStagger));

  const hasProgress = view ? view.youVsPast !== null || view.accuracyTrend !== null || view.planExperiment !== null : false;
  const hasChanged = view ? view.driftAlert !== null || view.biggestSurprise !== null : false;

  return (
    <Screen>
      <ScreenHeader title="Patterns" subtitle="What your time keeps telling you." />
      <ScrollView
        contentContainerStyle={{ gap: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        {showEmpty ? <PatternsEmpty /> : null}

        {view && !view.empty ? (
          <>
            <WeeklyReview view={view} />

            {/* 1 · IDENTITY */}
            {view.archetype ? (
              <Animated.View entering={rise()}><ArchetypeHero card={view.archetype} /></Animated.View>
            ) : null}

            {/* 2 · YOUR PROGRESS */}
            {hasProgress ? (
              <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
                <SectionHeader label="Your progress" />
                <ProgressChart trend={view.accuracyTrend} fallback={view.youVsPast} />
                {view.planExperiment ? <PlanExperiment card={view.planExperiment} /> : null}
              </Animated.View>
            ) : null}

            {/* 3 · WHAT CHANGED */}
            {hasChanged ? (
              <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
                <SectionHeader label="What changed" />
                {view.driftAlert ? <DriftNote card={view.driftAlert} /> : null}
                {view.biggestSurprise ? <BiggestSurprise card={view.biggestSurprise} /> : null}
              </Animated.View>
            ) : null}

            {/* 4 · YOUR NUMBERS */}
            {view.calibrationMap.length > 0 ? (
              <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
                <SectionHeader label="Your numbers" />
                <HonestMap rows={view.calibrationMap} />
              </Animated.View>
            ) : null}

            {/* 5 · PRO — one premium teaser (or the unlocked insight) */}
            <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
              <ProGate fallback={insights.length > 0 ? <StealsYourTimeLocked /> : null}>
                <StealsYourTime insights={insights} />
                <StealsYourTimeWeekly insights={insights} />
              </ProGate>
              <ProGate fallback={view.accuracyCorrelations.length > 0 ? <AccuracyCorrelationsLocked /> : null}>
                {view.accuracyCorrelations.length > 0 ? <AccuracyCorrelations correlations={view.accuracyCorrelations} /> : null}
              </ProGate>
              <ProGate fallback={contextInsights.length > 0 ? <ContextCorrelationsLocked /> : null}>
                {contextInsights.length > 0 ? <ContextCorrelations correlations={contextInsights} /> : null}
              </ProGate>
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
