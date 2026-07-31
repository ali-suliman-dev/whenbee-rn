import 'i18next';
import type en from './locales/en';

// Key types come from the fallback language's bundle, so a new namespace is
// typed the moment it is added to `locales/en/index.ts` — nothing to repeat here.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof en;
  }
}
