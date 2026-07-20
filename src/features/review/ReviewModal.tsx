import { useEffect } from 'react';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { SheetScrollView } from '@/src/components/SheetScrollView';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { analytics } from '@/src/services/analytics';
import { usePatterns } from '@/src/features/patterns/usePatterns';
import { useReasonInsights } from '@/src/features/patterns/useReasonInsights';
import { StealsYourTime } from '@/src/features/patterns/StealsYourTime';
import { AccuracyCorrelations } from '@/src/features/patterns/AccuracyCorrelations';
import { useReview } from './useReview';
import { CoverCard } from './cards/CoverCard';
import { AccuracyReadCard } from './cards/AccuracyReadCard';
import { TightenedCard } from './cards/TightenedCard';
import { ReflectionCard } from './cards/ReflectionCard';
import { WeekReadCard } from './cards/WeekReadCard';
import { ForwardActionCard } from './cards/ForwardActionCard';
import { BiggestSurpriseRitualCard } from './cards/BiggestSurpriseRitualCard';

// ──────────────────────────────────────────────────────────────────────────────
// ReviewModal — the Honest Week / Month ritual, opened from the Patterns card or
// the Monday notification. A calm, recomputed-live recap: cover → accuracy read →
// what tightened → biggest surprise → what steals your time → when you're sharpest
// → reflection. Every card omits itself when its data isn't earned (never a blank
// chart). No reclaim, no score, no red.
//
// Motion is entering-only (Fabric SIGABRT on `exiting`): the cards rise + stagger
// in once; reduced-motion skips the transform. `review_opened` fires on mount with
// its source; `review_completed` on Done/dismiss with how far the user got.
// ──────────────────────────────────────────────────────────────────────────────

type ReviewSource = 'card' | 'notification' | 'manual';

export function ReviewModal({ source = 'card' }: { source?: ReviewSource }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { summary, markSeen } = useReview();
  const { view } = usePatterns();
  const { insights } = useReasonInsights();

  // Mark this period seen the moment the recap opens (it flips the Patterns card to
  // its quiet row). Fire review_opened exactly once on mount.
  useEffect(() => {
    markSeen();
    analytics.capture('review_opened', {
      period_kind: summary?.period.kind ?? 'week',
      source,
    });
    // Mount-only: a re-render must not re-fire the funnel event or re-mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasWeekRead = summary?.weekRead != null;
  const hasAccuracy = summary?.accuracyLine != null;
  const hasForwardAction = summary?.forwardAction != null;
  const hasTightened = (summary?.tightened.length ?? 0) > 0;
  const hasSurprise = summary?.biggestSurprise != null;
  const hasSteals = insights.length > 0;
  const hasSharpest = (view?.accuracyCorrelations.length ?? 0) > 0;
  // Earned-card count drives the review_completed coverage number. Cover +
  // reflection always render; the middle six are conditional.
  const cardsSeen =
    2 +
    [hasWeekRead, hasAccuracy, hasForwardAction, hasTightened, hasSurprise, hasSteals, hasSharpest].filter(
      Boolean,
    ).length;

  function complete() {
    if (summary) {
      analytics.capture('review_completed', {
        period_kind: summary.period.kind,
        cards_seen: cardsSeen,
        scroll_depth: cardsSeen,
      });
    }
    router.back();
  }

  // Per-card entrance: rise + fade, staggered top→bottom (< ~500ms total). The
  // whole cascade is entering-only — no exiting layout animation on Fabric.
  let order = 0;
  const rise = () =>
    reduced ? undefined : FadeInDown.duration(t.motion.base).delay(order++ * t.motion.enterStagger);
  const Card = (node: React.ReactNode) => <Animated.View entering={rise()}>{node}</Animated.View>;

  if (!summary) {
    return (
      <Screen edges={['left', 'right']} horizontalPadding={false}>
        <SheetGrabber />
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      <SheetScrollView
        contentContainerStyle={{
          gap: t.space[4],
          paddingTop: t.space[2],
          paddingBottom: insets.bottom + t.space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />

        {/* 1 · Week read — verdict + daily sparkline (or cover fallback). */}
        {hasWeekRead
          ? Card(<WeekReadCard summary={summary} />)
          : Card(<CoverCard summary={summary} />)}

        {/* 2 · How your guesses landed. */}
        {hasAccuracy && summary.accuracyLine
          ? Card(
              <AccuracyReadCard
                line={summary.accuracyLine}
                sharpestPhrase={summary.sharpestPhrase}
              />,
            )
          : null}

        {/* 3 · One thing to try — forward action from biggest surprise. */}
        {hasForwardAction && summary.forwardAction
          ? Card(<ForwardActionCard action={summary.forwardAction} />)
          : null}

        {/* 4 · What tightened. */}
        {hasTightened ? Card(<TightenedCard rows={summary.tightened} />) : null}

        {/* 5 · Your biggest surprise — ritual card with optional confidence band. */}
        {hasSurprise && summary.biggestSurprise
          ? Card(
              <BiggestSurpriseRitualCard
                surprise={summary.biggestSurprise}
                band={summary.confidenceBand ?? null}
                loggedCount={summary.loggedCount}
              />,
            )
          : null}

        {/* 6 · What steals your time (Pro, reused). */}
        {hasSteals ? Card(<StealsYourTime insights={insights} />) : null}

        {/* 7 · When you're sharpest (Pro, reused). */}
        {hasSharpest && view ? Card(<AccuracyCorrelations correlations={view.accuracyCorrelations} />) : null}

        {/* 8 · Closing reflection (always present). */}
        {Card(<ReflectionCard question={summary.reflection} />)}

        <AppButton label="Done" variant="amber" size="lg" fullWidth onPress={complete} />
      </SheetScrollView>
    </Screen>
  );
}
