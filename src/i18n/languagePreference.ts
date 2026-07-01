import { kv } from '@/src/lib/kv';
import { isSupportedLang, type AppLang } from './resources';

const KEY = 'settings.languageOverride';
export type LanguagePreference = 'system' | AppLang;

export const getLanguagePreference = (): LanguagePreference => {
  const raw = kv.getString(KEY);
  if (raw === 'system' || (raw != null && isSupportedLang(raw))) return raw;
  return 'system';
};

export const setLanguagePreference = (value: LanguagePreference): void => {
  kv.set(KEY, value);
};
