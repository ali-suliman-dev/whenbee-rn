import 'i18next';
import type common from './locales/en/common.json';
import type onboarding from './locales/en/onboarding.json';
import type paywall from './locales/en/paywall.json';
import type settings from './locales/en/settings.json';
import type today from './locales/en/today.json';
import type addTask from './locales/en/addTask.json';
import type timer from './locales/en/timer.json';
import type notifications from './locales/en/notifications.json';
import type patterns from './locales/en/patterns.json';
import type voice from './locales/en/voice.json';
import type categoryDetail from './locales/en/categoryDetail.json';
import type review from './locales/en/review.json';
import type routines from './locales/en/routines.json';
import type whenbee from './locales/en/whenbee.json';
import type planner from './locales/en/planner.json';
import type reward from './locales/en/reward.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      onboarding: typeof onboarding;
      paywall: typeof paywall;
      settings: typeof settings;
      today: typeof today;
      addTask: typeof addTask;
      timer: typeof timer;
      notifications: typeof notifications;
      patterns: typeof patterns;
      voice: typeof voice;
      categoryDetail: typeof categoryDetail;
      review: typeof review;
      routines: typeof routines;
      whenbee: typeof whenbee;
      planner: typeof planner;
      reward: typeof reward;
      // add each namespace here as it is created (Task A4).
    };
  }
}
