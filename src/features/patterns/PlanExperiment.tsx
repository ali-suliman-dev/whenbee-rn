import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation('patterns');

  const verdict: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const note: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const block: ViewStyle = { gap: t.space[1.5] };

  const headline = tr(card.planWins ? 'planExperiment.headline.planWins' : 'planExperiment.headline.gutWins');
  const supporting = card.planWins
    ? tr('planExperiment.supporting.planWins', { timedPct: acc(card.timedError), retroPct: acc(card.retroError) })
    : tr('planExperiment.supporting.gutWins', { retroPct: acc(card.retroError), timedPct: acc(card.timedError) });

  // dismissId: "experiment:{timedCount}:{retroCount}" — encodes the observation
  // counts so that a new batch of data (different counts) re-shows the updated
  // verdict. Same counts = same insight = stays dismissed.
  const dismissId = `experiment:${card.timedCount}:${card.retroCount}`;

  return (
    <PatternCard
      eyebrow={tr('planExperiment.eyebrow')}
      icon="flask-outline"
      dismissLabel={tr('planExperiment.dismissLabel')}
      dismissId={dismissId}
    >
      <View style={block}>
        <Text style={verdict}>{headline}</Text>
        <Text style={detail}>{supporting}</Text>
        <Text style={note}>
          {tr('planExperiment.note', {
            count: card.timedCount + card.retroCount,
            timedCount: card.timedCount,
            retroCount: card.retroCount,
          })}
        </Text>
      </View>
    </PatternCard>
  );
}

/** The calm gated state — shown when one arm hasn't enough logs to compare yet. */
export function PlanExperimentPending() {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <PatternCard
      eyebrow={tr('planExperiment.eyebrow')}
      icon="flask-outline"
      dismissLabel={tr('planExperiment.dismissLabel')}
      dismissId="experiment-pending"
    >
      <Text style={body}>{tr('planExperiment.pending.body')}</Text>
    </PatternCard>
  );
}
