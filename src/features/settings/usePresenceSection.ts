import { useCallback } from 'react';
import { router } from 'expo-router';
import { analytics } from '@/src/services/analytics';
import { presenceAvailable } from '@/src/services/liveActivity';

/**
 * Feature hook for the Settings → Presence section.
 *
 * Keeps `presenceAvailable` and analytics out of `src/app/settings.tsx` and
 * `src/components/PresenceRingTeaser` (both live inside the ESLint boundary that
 * prohibits direct service imports). Route all service calls through here.
 */
export function usePresenceSection() {
  const isPresenceAvailable = presenceAvailable();

  const handlePresenceCta = useCallback(() => {
    analytics.capture('paywall_view', { trigger: 'persistent_presence' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'persistent_presence' } });
  }, []);

  return { isPresenceAvailable, handlePresenceCta };
}
