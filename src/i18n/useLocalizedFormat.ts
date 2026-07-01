import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { makeFormatters } from './format';

const BCP47: Record<string, string> = { en: 'en-US', sv: 'sv-SE' };

/** Locale-aware date/number formatters for the active app language. */
export const useLocalizedFormat = () => {
  const { i18n } = useTranslation();
  const locale = BCP47[i18n.language] ?? 'en-US';
  return useMemo(() => makeFormatters(locale), [locale]);
};
