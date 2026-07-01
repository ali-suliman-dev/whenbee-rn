import { useTranslation } from 'react-i18next';
import { ProTeaserCard } from './ProTeaserCard';

// "When you're sharpest" (S3) teaser — opens the shared Pro-Patterns paywall.
export function AccuracyCorrelationsLocked() {
  const { t } = useTranslation('patterns');
  return (
    <ProTeaserCard
      eyebrow={t('accuracyCorrelationsLocked.eyebrow')}
      headline={t('accuracyCorrelationsLocked.headline')}
      sub={t('accuracyCorrelationsLocked.sub')}
      cta={t('accuracyCorrelationsLocked.cta')}
      trigger="steals_your_time"
      preview="rhythm"
    />
  );
}
