// Per-locale, kv-persisted consent for the network (Apple/Google) speech
// recognizer. Recognition is on-device-only unless the user has explicitly
// agreed — once, per STT locale — to fall back to the OS network recognizer
// when offline recognition isn't available for that language on this device.

import { kv } from '@/src/lib/kv';

const consentKey = (sttLocale: string): string => `voice.networkSttConsent.${sttLocale}`;

export const hasNetworkSttConsent = (sttLocale: string): boolean =>
  kv.getString(consentKey(sttLocale)) === 'true';

export const grantNetworkSttConsent = (sttLocale: string): void => {
  kv.set(consentKey(sttLocale), 'true');
};
