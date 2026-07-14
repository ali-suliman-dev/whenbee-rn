import { useEffect } from 'react';
import { router, useRootNavigationState, type Href } from 'expo-router';
import { consumePendingTimerHref } from './timerDeepLinkGate';

/**
 * Completes a cold-boot timer deep link. +native-intent reroutes the initial
 * link to Today and parks the real href; once the root navigator is ready this
 * pushes the timer sheet — a post-boot PUSH presents the formSheet correctly,
 * where an initial-state restore silently does not (see timerDeepLinkGate).
 * Renders nothing; mounted once in the root layout.
 */
export function PendingTimerOpener(): null {
  const navReady = useRootNavigationState()?.key != null;
  useEffect(() => {
    if (!navReady) return;
    const href = consumePendingTimerHref();
    if (href !== null) router.push(href as Href);
  }, [navReady]);
  return null;
}
