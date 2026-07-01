import type { TFunction } from 'i18next';

/** Split a minute count into whole hours + remainder minutes. PURE. */
export const durationParts = (totalMin: number): { h: number; m: number } => {
  const mins = Math.max(0, Math.round(totalMin));
  return { h: Math.floor(mins / 60), m: mins % 60 };
};

/** Localized compact duration ("1h 15m"). Unit words come from the translator,
 *  never hardcoded. Mirrors the old fmtHm() shape. */
export const formatDuration = (totalMin: number, t: TFunction): string => {
  const { h, m } = durationParts(totalMin);
  const hs = t('duration.h', { count: h });
  const ms = t('duration.m', { count: m });
  if (h > 0 && m > 0) return `${hs} ${ms}`;
  if (h > 0) return hs;
  return ms;
};
