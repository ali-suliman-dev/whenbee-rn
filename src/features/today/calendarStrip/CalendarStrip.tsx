// src/features/today/calendarStrip/CalendarStrip.tsx
// Thin selector for the calendar strip. Two designs ship side by side behind a
// runtime toggle (settingsStore.stripVariant) so the founder can A/B them live
// on-device, then delete the loser. All paging/store logic lives in
// useCalendarStripData; the variants only differ visually.
//
// TEMP A/B — after the decision, collapse this to the winning component, delete
// the loser's file, remove the settingsStore field + the Settings toggle, and
// delete stripVariant.ts. See docs/product/specs/2026-06-25-calendar-strip-ab.md.

import React from 'react';

import { useSettingsStore } from '@/src/stores/settingsStore';

import { CalendarStripLens } from './CalendarStripLens';
import { CalendarStripSegment } from './CalendarStripSegment';

export function CalendarStrip() {
  const variant = useSettingsStore((s) => s.stripVariant);
  return variant === 'lens' ? <CalendarStripLens /> : <CalendarStripSegment />;
}
