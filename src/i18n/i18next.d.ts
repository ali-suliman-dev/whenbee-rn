import 'i18next';
import type common from './locales/en/common.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      // add each namespace here as it is created (Task A4).
    };
  }
}
