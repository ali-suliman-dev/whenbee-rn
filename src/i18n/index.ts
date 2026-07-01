import 'intl-pluralrules'; // Hermes lacks Intl.PluralRules; polyfill before i18next init.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, FALLBACK_LANG, SUPPORTED_LANGS } from './resources';
import { detectLanguage } from './detectLanguage';

export const initI18n = async (): Promise<void> => {
  if (i18n.isInitialized) return;
  // eslint-disable-next-line import/no-named-as-default-member -- `i18n` default export intentionally used for its `.use`/`.init` instance methods
  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: detectLanguage(),
      fallbackLng: FALLBACK_LANG,
      supportedLngs: SUPPORTED_LANGS as unknown as string[],
      defaultNS: 'common',
      ns: ['common', 'onboarding', 'paywall', 'settings', 'today', 'addTask', 'timer', 'notifications', 'patterns', 'voice', 'categoryDetail', 'review', 'routines', 'whenbee', 'planner', 'reward'], // extend as namespaces are added.
      interpolation: { escapeValue: false }, // RN has no XSS; i18next default escapes.
      returnNull: false,
    });
};

export default i18n;
