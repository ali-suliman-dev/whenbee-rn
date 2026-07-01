import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { makeFormatters, localeForLang } from './format';

/** Locale-aware date/number formatters for the active app language. */
export const useLocalizedFormat = () => {
  const { i18n } = useTranslation();
  const locale = localeForLang(i18n.language);
  return useMemo(() => makeFormatters(locale), [locale]);
};
