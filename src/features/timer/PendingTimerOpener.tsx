import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { router, useRootNavigationState, type Href } from 'expo-router';
import { consumePendingTimerHref } from './timerDeepLinkGate';

// How long past nav-ready + first interactions to wait before pushing the sheet.
// react-native-screens quietly downgrades a formSheet pushed before the base
// screen's first draw to a full-screen card (or drops the presentation
// entirely); the navigator being "ready" in JS is NOT that signal. Empirical:
// immediate and one-frame-deferred pushes both fail cold-boot; a short real
// delay lands after the first draw reliably. Today is visible underneath for
// this beat, then the sheet slides up — reads as intentional.
const PRESENT_DELAY_MS = 500;

/**
 * Completes a cold-boot timer deep link. +native-intent reroutes the initial
 * link to Today and parks the real href; once the root navigator is ready this
 * pushes the timer sheet — a post-boot PUSH presents the formSheet correctly,
 * where an initial-state restore silently does not (see timerDeepLinkGate).
 *
 * The push is deferred past initial interactions + one frame: pushing during
 * the navigator's first commit makes react-native-screens fall back to a plain
 * full-screen CARD (no sheet, no scrim, Today not beneath) — the sheet
 * presentation only engages once the base screen has actually laid out.
 *
 * Renders nothing; mounted once in the root layout.
 */
export function PendingTimerOpener(): null {
  const navReady = useRootNavigationState()?.key != null;
  useEffect(() => {
    if (!navReady) return;
    const href = consumePendingTimerHref();
    if (href === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (!cancelled) router.push(href as Href);
      }, PRESENT_DELAY_MS);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timer !== null) clearTimeout(timer);
    };
  }, [navReady]);
  return null;
}
