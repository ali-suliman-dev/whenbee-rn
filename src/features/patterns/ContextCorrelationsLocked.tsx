import { useTranslation } from 'react-i18next';
import { ProTeaserCard } from './ProTeaserCard';

// "What moves your accuracy" (S4) teaser.
export function ContextCorrelationsLocked() {
  const { t } = useTranslation('patterns');
  return (
    <ProTeaserCard
      eyebrow={t('contextCorrelationsLocked.eyebrow')}
      headline={t('contextCorrelationsLocked.headline')}
      sub={t('contextCorrelationsLocked.sub')}
      cta={t('contextCorrelationsLocked.cta')}
      trigger="steals_your_time"
      preview="bars"
    />
  );
}
