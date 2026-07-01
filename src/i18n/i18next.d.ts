import 'i18next';
import type common from './locales/en/common.json';
import type onboarding from './locales/en/onboarding.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      onboarding: typeof onboarding;
      // add each namespace here as it is created (Task A4).
    };
  }
}
