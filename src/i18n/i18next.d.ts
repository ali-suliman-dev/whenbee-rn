import 'i18next';
import type common from './locales/en/common.json';
import type onboarding from './locales/en/onboarding.json';
import type paywall from './locales/en/paywall.json';
import type settings from './locales/en/settings.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      onboarding: typeof onboarding;
      paywall: typeof paywall;
      settings: typeof settings;
      // add each namespace here as it is created (Task A4).
    };
  }
}
