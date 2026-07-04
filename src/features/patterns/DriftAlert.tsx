import { Text, type TextStyle } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { PatternCard } from './PatternCard';
import type { DriftAlertCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// DriftNote (S9) — "what changed". A quiet amber margin-note in the Insights feed.
// Reports a shift in pace, never a verdict: the honest numbers already follow
// along, so there is nothing to fix. Wrapped in PatternCard so it is dismissable
// (§9.3 — Insights is a dismissable feed of DriftNote + BiggestSurprise + PlanExperiment).
//
// dismissId scheme: "drift:{categoryId}:{direction}:{mag}"
//   - categoryId   — which category drifted
//   - direction    — "slower" | "faster" (slowerLately flag)
//   - mag          — the rounded magnitude bucket (0.1 steps) of the multiplier
//     delta so that a minor float oscillation on the same drift doesn't re-show
//     the card, while a meaningfully different drift magnitude (new data) gets a
//     new id and appears fresh.
//
// Example: "drift:admin:slower:0.4" stays dismissed until the delta shifts by
// ≥0.1 or the direction flips — at which point the user genuinely has new info.
// ──────────────────────────────────────────────────────────────────────────────

export function DriftNote({ card }: { card: DriftAlertCard }) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const { categoryId, categoryName, earlyMultiplier, recentMultiplier, slowerLately } = card;

  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };
  const name: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.amberText };

  const lead = tr(slowerLately ? 'driftNote.lead.slower' : 'driftNote.lead.faster');

  // Bucket the delta to 0.1 steps so minor float oscillations don't re-show
  // the card, but a real shift in magnitude produces a new id.
  const delta = Math.abs(recentMultiplier - earlyMultiplier);
  const magBucket = (Math.round(delta * 10) / 10).toFixed(1);
  const direction = slowerLately ? 'slower' : 'faster';
  const dismissId = `drift:${categoryId}:${direction}:${magBucket}`;

  return (
    <PatternCard
      eyebrow={tr('driftNote.eyebrow')}
      icon="trending-up-outline"
      dismissLabel={tr('driftNote.dismissLabel')}
      dismissId={dismissId}
    >
      <Text style={body}>
        <Trans
          i18nKey="driftNote.body"
          ns="patterns"
          values={{
            categoryName,
            lead,
            early: earlyMultiplier.toFixed(1),
            recent: recentMultiplier.toFixed(1),
          }}
          components={{ bold: <Text style={name} /> }}
        />
      </Text>
    </PatternCard>
  );
}

