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
import enAddTask from './locales/en/addTask.json';
import svAddTask from './locales/sv/addTask.json';
import enTimer from './locales/en/timer.json';
import svTimer from './locales/sv/timer.json';
import enNotifications from './locales/en/notifications.json';
import svNotifications from './locales/sv/notifications.json';
import enPatterns from './locales/en/patterns.json';
import svPatterns from './locales/sv/patterns.json';
import enVoice from './locales/en/voice.json';
import svVoice from './locales/sv/voice.json';
import enCategoryDetail from './locales/en/categoryDetail.json';
import svCategoryDetail from './locales/sv/categoryDetail.json';
import enReview from './locales/en/review.json';
import svReview from './locales/sv/review.json';
// NOTE: as each namespace is added in later tasks, import it here for both langs.

export const SUPPORTED_LANGS = ['en', 'sv'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const FALLBACK_LANG: AppLang = 'en';

export const resources = {
  en: {
    common: enCommon,
    onboarding: enOnboarding,
    paywall: enPaywall,
    settings: enSettings,
    today: enToday,
    addTask: enAddTask,
    timer: enTimer,
    notifications: enNotifications,
    patterns: enPatterns,
    voice: enVoice,
    categoryDetail: enCategoryDetail,
    review: enReview,
  },
  sv: {
    common: svCommon,
    onboarding: svOnboarding,
    paywall: svPaywall,
    settings: svSettings,
    today: svToday,
    addTask: svAddTask,
    timer: svTimer,
    notifications: svNotifications,
    patterns: svPatterns,
    voice: svVoice,
    categoryDetail: svCategoryDetail,
    review: svReview,
  },
} as const;

export const isSupportedLang = (v: string): v is AppLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(v);
