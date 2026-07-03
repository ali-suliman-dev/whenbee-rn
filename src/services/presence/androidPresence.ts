// Default resolution for every platform except Android (Metro swaps in the
// `.android.ts` variant on Android). Presence on iOS is the native WhenbeePresence
// module, resolved separately in liveActivity.ts, so here we simply decline.
import type { NativePresenceModule } from '@/src/services/liveActivity';

export function loadAndroidPresence(): NativePresenceModule | null {
  return null;
}
