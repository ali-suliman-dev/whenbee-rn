import { useEffect } from 'react';
import { AppState } from 'react-native';
import i18n from './index';
import { detectLanguage } from './detectLanguage';
import { getLanguagePreference } from './languagePreference';

// ──────────────────────────────────────────────────────────────────────────────
// useSystemLanguageSync — follow the DEVICE language while the preference is
// 'system'.
//
// `initI18n` resolves the device language exactly once, at boot. So a user who
// switches their phone to Swedish and comes back to an app that is already warm
// in memory keeps seeing English until the app is killed and relaunched — the
// preference says "system", and the app is not following the system.
//
// Re-detecting when the app returns to the foreground closes that: iOS and
// Android both background an app while the user is in system Settings, so the
// change is always observed on the way back in. An explicit override (en/sv)
// short-circuits — the user's choice outranks the device.
// ──────────────────────────────────────────────────────────────────────────────

export function useSystemLanguageSync(): void {
  useEffect(() => {
    const syncIfFollowingSystem = () => {
      if (getLanguagePreference() !== 'system') return;
      const next = detectLanguage();
      if (next !== i18n.language) void i18n.changeLanguage(next);
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncIfFollowingSystem();
    });
    return () => {
      sub.remove();
    };
  }, []);
}
