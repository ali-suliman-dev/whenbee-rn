import en from './locales/en';
import sv from './locales/sv';

// ──────────────────────────────────────────────────────────────────────────────
// The language registry. One line per language, nothing per namespace.
//
// Namespaces are listed once per language, inside `locales/<lang>/index.ts`.
// This file only answers "which languages exist, and which is the fallback",
// so ADDING A LANGUAGE IS THREE EDITS:
//   1. copy `locales/en/` to `locales/<code>/` and translate the JSON
//   2. copy `locales/en/index.ts` alongside it (same body, same relative paths)
//   3. add the code to SUPPORTED_LANGS and the import + entry below
// The i18next `ns` array, the key types, and the parity test all follow
// automatically — `en` is the single source of truth for shape.
// ──────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGS = ['en', 'sv'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const FALLBACK_LANG: AppLang = 'en';

export const resources = { en, sv } as const;

/**
 * Each language's name IN ITS OWN LANGUAGE. A language picker always lists
 * endonyms — a Swedish speaker looking for Swedish scans for "Svenska", not for
 * "Swedish" translated into whatever language the app happens to be in — so
 * these deliberately live here as data rather than as per-language keys in the
 * settings namespace. Adding a language means adding one line here, and the
 * picker picks it up with no further edits.
 */
export const LANGUAGE_ENDONYM: Record<AppLang, string> = {
  en: 'English',
  sv: 'Svenska',
};

/** Every namespace the app ships, derived from the fallback language's bundle. */
export const NAMESPACES = Object.keys(resources[FALLBACK_LANG]) as (keyof typeof en)[];

export const isSupportedLang = (v: string): v is AppLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(v);
