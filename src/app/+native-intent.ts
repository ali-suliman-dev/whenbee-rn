import { rewriteInitialTimerLink } from '@/src/features/timer/timerDeepLinkGate';

// Runs BEFORE expo-router navigates an incoming native deep link. Cold-boot
// links into the timer formSheet are rerouted through Today and re-pushed after
// boot (see timerDeepLinkGate for why); everything else passes through.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    return initial ? rewriteInitialTimerLink(path) : path;
  } catch {
    // Never crash in this hook — fall back to opening the app at Today.
    return '/';
  }
}
