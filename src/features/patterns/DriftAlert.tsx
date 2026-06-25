import { Text, type TextStyle } from 'react-native';
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
  const { categoryId, categoryName, earlyMultiplier, recentMultiplier, slowerLately } = card;

  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink };
  const name: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.amberText };

  const lead = slowerLately ? 'is taking longer lately' : 'is moving quicker lately';

  // Bucket the delta to 0.1 steps so minor float oscillations don't re-show
  // the card, but a real shift in magnitude produces a new id.
  const delta = Math.abs(recentMultiplier - earlyMultiplier);
  const magBucket = (Math.round(delta * 10) / 10).toFixed(1);
  const direction = slowerLately ? 'slower' : 'faster';
  const dismissId = `drift:${categoryId}:${direction}:${magBucket}`;

  return (
    <PatternCard eyebrow="PACE SHIFT" icon="trending-up-outline" dismissLabel="Hide this drift note" dismissId={dismissId}>
      <Text style={body}>
        <Text style={name}>{categoryName}</Text> {lead} — it used to run {earlyMultiplier.toFixed(1)}×, now nearer{' '}
        {recentMultiplier.toFixed(1)}×. Your honest numbers already follow along.
      </Text>
    </PatternCard>
  );
}

