// App language → BCP-47 STT locale. Extend alongside SUPPORTED_LANGS.
const STT_LOCALE: Record<string, string> = { en: 'en-US', sv: 'sv-SE' };
const DEFAULT_STT = 'en-US';

export const appLangToSttLocale = (lang: string): string =>
  STT_LOCALE[lang] ?? DEFAULT_STT;
