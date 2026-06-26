// src/features/today/calendarStrip/stripVariant.ts
// Single source of truth for which calendar-strip variant renders.
//
// TEMP A/B: two strip designs ship side by side behind a runtime toggle
// (settingsStore.stripVariant) so the founder can compare them live on-device.
// After the decision, delete the losing CalendarStrip*.tsx, collapse the selector
// in CalendarStrip.tsx, remove the settingsStore field + the Settings TEMP row,
// and delete this file. See docs/product/specs/2026-06-25-calendar-strip-ab.md.

/** 'lens' = Focus Lens (A1), 'segment' = Sliding Segment (B). */
export type StripVariant = 'lens' | 'segment';

/** Default the toggle starts on (and the value the selector collapses to later). */
export const DEFAULT_STRIP_VARIANT: StripVariant = 'segment';
