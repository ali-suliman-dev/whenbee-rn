import { ProTeaserCard } from './ProTeaserCard';

// "When you're sharpest" (S3) teaser — opens the shared Pro-Patterns paywall.
export function AccuracyCorrelationsLocked() {
  return (
    <ProTeaserCard
      eyebrow="WHENBEE PRO"
      headline="Know your sharpest hours."
      sub="Some hours you read time better than others. See exactly when — and when to leave a little more buffer."
      cta="Reveal my rhythm"
      trigger="steals_your_time"
      preview="rhythm"
    />
  );
}
