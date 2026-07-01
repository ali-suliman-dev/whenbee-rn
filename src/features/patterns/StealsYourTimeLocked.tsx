import { useTranslation } from 'react-i18next';
import { ProTeaserCard } from './ProTeaserCard';

// "What steals your time" (S12) teaser.
export function StealsYourTimeLocked() {
  const { t } = useTranslation('patterns');
  return (
    <ProTeaserCard
      eyebrow={t('stealsYourTimeLocked.eyebrow')}
      headline={t('stealsYourTimeLocked.headline')}
      sub={t('stealsYourTimeLocked.sub')}
      cta={t('stealsYourTimeLocked.cta')}
      trigger="steals_your_time"
      preview="bars"
    />
  );
}
