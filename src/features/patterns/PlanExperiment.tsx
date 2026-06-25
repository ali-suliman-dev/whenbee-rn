import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { PatternCard } from './PatternCard';
import type { PlanExperimentCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// PlanExperiment (S2) — with-a-plan vs winging-it. Proxy available today: a timed
// log means you ran the one-tap timer (committed in the moment); a retro log was
// filled in afterward (winged it). We compare accuracy and report the honest
// verdict — if winging it is sharper, we say so plainly.
//
// When the data to compute this isn't there yet (one arm too thin), the parent
// passes `card = null` and renders the gated "not enough data yet" state instead.
// ──────────────────────────────────────────────────────────────────────────────

function acc(error: number): number {
  return Math.round((1 - error) * 100);
}

export function PlanExperiment({ card }: { card: PlanExperimentCard }) {
  const t = useTheme();

  const verdict: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  const headline = card.planWins
    ? 'Running the timer keeps you sharper.'
    : 'You read time fine without the timer.';
  const supporting = card.planWins
    ? `Timed tasks land ${acc(card.timedError)}% accurate vs ${acc(card.retroError)}% when logged after.`
    : `Logged-after tasks land ${acc(card.retroError)}% accurate vs ${acc(card.timedError)}% when timed. Honestly — your gut does well here.`;

  // dismissId: "experiment:{timedCount}:{retroCount}" — encodes the observation
  // counts so that a new batch of data (different counts) re-shows the updated
  // verdict. Same counts = same insight = stays dismissed.
  const dismissId = `experiment:${card.timedCount}:${card.retroCount}`;

  return (
    <PatternCard eyebrow="PLAN VS WING IT" icon="flask-outline" dismissLabel="Hide the plan experiment" dismissId={dismissId}>
      <View style={block}>
        <Text style={verdict}>{headline}</Text>
        <Text style={detail}>{supporting}</Text>
        <Text style={note}>
          Based on {card.timedCount} timed and {card.retroCount} logged-after {card.timedCount + card.retroCount === 1 ? 'task' : 'tasks'}.
        </Text>
      </View>
    </PatternCard>
  );
}

/** The calm gated state — shown when one arm hasn't enough logs to compare yet. */
export function PlanExperimentPending() {
  const t = useTheme();
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <PatternCard eyebrow="PLAN VS WING IT" icon="flask-outline" dismissLabel="Hide the plan experiment" dismissId="experiment-pending">
      <Text style={body}>
        A few more timed and a few logged-after tasks and you&apos;ll see whether the timer makes you
        sharper. No rush.
      </Text>
    </PatternCard>
  );
}
