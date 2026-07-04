import { getLocales } from 'expo-localization';
import { FALLBACK_LANG, isSupportedLang, type AppLang } from './resources';
import { getLanguagePreference } from './languagePreference';

/** Active app language: explicit user override wins, else the device language if
 *  supported, else English. Never throws — expo-localization is native-guarded by
 *  its own JS shim, but a missing binary would return []. */
export const detectLanguage = (): AppLang => {
  const pref = getLanguagePreference();
  if (pref !== 'system') return pref;
  const deviceCode = getLocales()[0]?.languageCode ?? FALLBACK_LANG;
  return isSupportedLang(deviceCode) ? deviceCode : FALLBACK_LANG;
};
