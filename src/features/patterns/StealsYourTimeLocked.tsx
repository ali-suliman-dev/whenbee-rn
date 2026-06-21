import { ProTeaserCard } from './ProTeaserCard';

// "What steals your time" (S12) teaser.
export function StealsYourTimeLocked() {
  return (
    <ProTeaserCard
      eyebrow="WHENBEE PRO"
      headline="See where your time really goes."
      sub="Every time you note why a task ran long, that's a clue. Pro reads them back: the cause behind your overruns, by category."
      cta="Show me the cause"
      trigger="steals_your_time"
      preview="bars"
    />
  );
}
