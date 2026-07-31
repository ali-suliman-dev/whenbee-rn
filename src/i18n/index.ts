import 'intl-pluralrules'; // Hermes lacks Intl.PluralRules; polyfill before i18next init.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, FALLBACK_LANG, SUPPORTED_LANGS, NAMESPACES } from './resources';
import { detectLanguage } from './detectLanguage';

export const initI18n = async (): Promise<void> => {
  if (i18n.isInitialized) return;
  // eslint-disable-next-line import/no-named-as-default-member -- `i18n` default export intentionally used for its `.use`/`.init` instance methods
  await i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: FALLBACK_LANG,
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: 'common',
    ns: NAMESPACES, // derived from the en bundle — a new namespace needs no edit here.
    interpolation: { escapeValue: false }, // RN has no XSS; i18next default escapes.
    returnNull: false,
    // A miss renders the KEY ("ready.headline") rather than throwing, so a
    // stale bundle or a typo'd key looks like a rendering bug and can reach a
    // device unnoticed. In dev, say so loudly — the message names the key, the
    // namespace and the language, and the usual cause is a stale Metro cache
    // holding old locale JSON (`npx expo start -c`).
    saveMissing: __DEV__,
    missingKeyHandler: __DEV__
      ? (lngs, ns, key) => {
          console.error(
            `[i18n] MISSING KEY "${ns}:${key}" for [${lngs.join(', ')}] — the UI is ` +
              `rendering the key itself. If the key exists in src/i18n/locales/, the ` +
              `bundle is stale: restart Metro with \`npx expo start -c\`.`,
          );
        }
      : undefined,
  });
};

export default i18n;
