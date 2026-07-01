import enCommon from './locales/en/common.json';
import svCommon from './locales/sv/common.json';
import enOnboarding from './locales/en/onboarding.json';
import svOnboarding from './locales/sv/onboarding.json';
import enPaywall from './locales/en/paywall.json';
import svPaywall from './locales/sv/paywall.json';
import enSettings from './locales/en/settings.json';
import svSettings from './locales/sv/settings.json';
import enToday from './locales/en/today.json';
import svToday from './locales/sv/today.json';
// NOTE: as each namespace is added in later tasks, import it here for both langs.

export const SUPPORTED_LANGS = ['en', 'sv'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const FALLBACK_LANG: AppLang = 'en';

export const resources = {
  en: { common: enCommon, onboarding: enOnboarding, paywall: enPaywall, settings: enSettings, today: enToday },
  sv: { common: svCommon, onboarding: svOnboarding, paywall: svPaywall, settings: svSettings, today: svToday },
} as const;

export const isSupportedLang = (v: string): v is AppLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(v);
