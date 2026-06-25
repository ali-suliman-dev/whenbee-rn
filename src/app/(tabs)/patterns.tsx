import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { usePatterns } from '@/src/features/patterns/usePatterns';
import { ArchetypeHero, ArchetypePlaceholder } from '@/src/features/patterns/Archetype';
import { ProgressChart } from '@/src/features/patterns/ProgressChart';
import { PlanExperiment } from '@/src/features/patterns/PlanExperiment';
import { BiggestSurprise } from '@/src/features/patterns/BiggestSurprise';
import { DriftNote } from '@/src/features/patterns/DriftAlert';
import { HonestMap } from '@/src/features/patterns/CalibrationMap';
import { SectionHeader } from '@/src/features/patterns/SectionHeader';
import { PatternsEmpty } from '@/src/features/patterns/PatternsEmpty';
import { useReview } from '@/src/features/review/useReview';
import { ReviewRitualCard } from '@/src/features/review/ReviewRitualCard';
import { ReviewRitualLocked } from '@/src/features/review/ReviewRitualLocked';
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
import { FocusPatternsCard } from '@/src/features/patterns/FocusPatternsCard';
import { PatternsSegment, type PatternsTab } from '@/src/features/patterns/PatternsSegment';

// ──────────────────────────────────────────────────────────────────────────────
// Patterns — segmented self-insight surface.
//
// Structure:
//   [pinned] ArchetypeHero / ArchetypePlaceholder
//   [pinned] ReviewRitualCard (Pro) / ReviewRitualLocked (free)
//   [pinned] PatternsSegment control (Numbers | Insights | Correlations)
//   [routed] selected segment content only
//
// No guilt, no streaks, amber stays scarce. Entering-only on Fabric.
// ──────────────────────────────────────────────────────────────────────────────

export default function Patterns() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const { view } = usePatterns();
  const { summary: reviewSummary, period: reviewPeriod, isFresh: reviewFresh } = useReview();
  const { insights } = useReasonInsights();
  const { insights: contextInsights } = useContextInsights();
  const [tab, setTab] = useState<PatternsTab>('numbers');

  const showEmpty = view !== null && view.empty;

  // order resets to 0 each render so stagger always starts fresh from the top
  let order = 0;
  const rise = () => (reduced ? undefined : FadeInDown.duration(t.motion.base).delay((order++) * t.motion.enterStagger));

  // For non-Pro users: show exactly ONE locked teaser, chosen by the most
  // compelling data available. Priority: reason insights → accuracy → context.
  const lockedTeaser: 'steals' | 'accuracy' | 'context' | null = view
    ? insights.length > 0
      ? 'steals'
      : view.accuracyCorrelations.length > 0
        ? 'accuracy'
        : contextInsights.length > 0
          ? 'context'
          : null
    : null;

  // ── Segment content renderers ────────────────────────────────────────────────

  function renderNumbers() {
    if (!view) return null;
    return (
      <>
        {/* Progress — always rendered; ProgressChart handles its own empty state */}
        <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
          <SectionHeader label="Your progress" />
          <ProgressChart trend={view.accuracyTrend} fallback={view.youVsPast} />
          {view.planExperiment ? <PlanExperiment card={view.planExperiment} /> : null}
        </Animated.View>

        {/* Your numbers */}
        {view.calibrationMap.length > 0 ? (
          <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
            <SectionHeader label="Your numbers" />
            <HonestMap rows={view.calibrationMap} />
          </Animated.View>
        ) : null}

        {/* Your focus */}
        <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
          <SectionHeader label="Your focus" />
          <FocusPatternsCard />
        </Animated.View>
      </>
    );
  }

  function renderInsights() {
    if (!view) return null;
    const hasDrift = view.driftAlert !== null;
    const hasSurprise = view.biggestSurprise !== null;
    const hasAny = hasDrift || hasSurprise;

    if (!hasAny) {
      return (
        <Animated.View entering={rise()}>
          <Text
            style={{
              color: t.colors.inkSoft,
              fontSize: 14,
              textAlign: 'center',
              paddingVertical: t.space[6],
            }}
          >
            {'You\'re all caught up.'}
          </Text>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
        {hasDrift ? <DriftNote card={view.driftAlert!} /> : null}
        {hasSurprise ? <BiggestSurprise card={view.biggestSurprise!} /> : null}
      </Animated.View>
    );
  }

  function renderCorrelations() {
    if (!view) return null;
    return (
      <Animated.View entering={rise()} style={{ gap: t.space[3] }}>
        <ProGate fallback={lockedTeaser === 'steals' ? <StealsYourTimeLocked /> : null}>
          <StealsYourTime insights={insights} />
          <StealsYourTimeWeekly insights={insights} />
        </ProGate>
        <ProGate fallback={lockedTeaser === 'accuracy' ? <AccuracyCorrelationsLocked /> : null}>
          {view.accuracyCorrelations.length > 0 ? <AccuracyCorrelations correlations={view.accuracyCorrelations} /> : null}
        </ProGate>
        <ProGate fallback={lockedTeaser === 'context' ? <ContextCorrelationsLocked /> : null}>
          {contextInsights.length > 0 ? <ContextCorrelations correlations={contextInsights} /> : null}
        </ProGate>
      </Animated.View>
    );
  }

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
            {/* 1 · IDENTITY — always pinned */}
            {view.archetype ? (
              <Animated.View entering={rise()}><ArchetypeHero card={view.archetype} calibrationMap={view.calibrationMap} /></Animated.View>
            ) : (
              <Animated.View entering={rise()}>
                <ArchetypePlaceholder onTakeQuiz={() => router.push('/(modals)/archetype-quiz')} />
              </Animated.View>
            )}

            {/* 2 · REVIEW RITUAL — always pinned under hero */}
            <Animated.View entering={rise()}>
              <ProGate fallback={reviewSummary ? <ReviewRitualLocked period={reviewPeriod} /> : null}>
                {reviewSummary ? <ReviewRitualCard summary={reviewSummary} isFresh={reviewFresh} /> : null}
              </ProGate>
            </Animated.View>

            {/* 3 · SEGMENT CONTROL — always pinned */}
            <Animated.View entering={rise()}>
              <PatternsSegment value={tab} onChange={setTab} />
            </Animated.View>

            {/* 4 · SEGMENT CONTENT — only the selected tab renders */}
            {tab === 'numbers' ? renderNumbers() : null}
            {tab === 'insights' ? renderInsights() : null}
            {tab === 'correlations' ? renderCorrelations() : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
