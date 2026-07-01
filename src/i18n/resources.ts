import enCommon from './locales/en/common.json';
import svCommon from './locales/sv/common.json';
import enOnboarding from './locales/en/onboarding.json';
import svOnboarding from './locales/sv/onboarding.json';
// NOTE: as each namespace is added in later tasks, import it here for both langs.

export const SUPPORTED_LANGS = ['en', 'sv'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const FALLBACK_LANG: AppLang = 'en';

export const resources = {
  en: { common: enCommon, onboarding: enOnboarding },
  sv: { common: svCommon, onboarding: svOnboarding },
} as const;

export const isSupportedLang = (v: string): v is AppLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(v);
