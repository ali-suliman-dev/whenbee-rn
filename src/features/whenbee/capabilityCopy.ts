import type { TFunction } from 'i18next';
import type { CompanionCapability } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// capabilityCopy — id → localised label for the companion capability ladder.
//
// The engine (`src/engine/companion.ts`) must stay pure (no i18n, no React), so
// its `CompanionCapability.label` is an internal/English fallback only — never
// render it directly. This module maps each capability id to its
// `whenbee:ladder.*` key; `capabilityLabel` resolves that key through the
// caller's translator.
//
// The `Record<CompanionCapability['id'], string>` type is exhaustive on purpose:
// adding a new capability id to the engine without adding its copy here is a
// compile error, not a silent English leak.
// ──────────────────────────────────────────────────────────────────────────────

type LadderCopyKey =
  | 'ladder.runningFinishTime'
  | 'ladder.todayDoneTime'
  | 'ladder.startByAnchor'
  | 'ladder.honestDayForecast'
  | 'ladder.driftRecalibration'
  | 'ladder.keeperStanding';

const CAPABILITY_COPY_KEY: Record<CompanionCapability['id'], LadderCopyKey> = {
  'running-finish-time': 'ladder.runningFinishTime',
  'today-done-time': 'ladder.todayDoneTime',
  'start-by-anchor': 'ladder.startByAnchor',
  'honest-day-forecast': 'ladder.honestDayForecast',
  'drift-recalibration': 'ladder.driftRecalibration',
  'keeper-standing': 'ladder.keeperStanding',
};

/** `tr` is the whenbee-namespace translator (from `useTranslation('whenbee')`).
 *  Required: this is display copy, so there is no correct untranslated answer. */
export function capabilityLabel(id: CompanionCapability['id'], tr: TFunction<'whenbee'>): string {
  return tr(CAPABILITY_COPY_KEY[id]);
}
