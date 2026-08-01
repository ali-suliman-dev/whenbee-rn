import i18n from '@/src/i18n';
import { resolveWeekPeriod, resolveMonthPeriod } from '@/src/engine';
import { reviewPeriodLabel } from '../periodLabel';

// The engine emits a locale-free period id; the human label is formatted here.
// A Swedish user must never read an English month name, and Swedish months are
// lowercase, which is exactly what `Intl` gives us (and a hardcoded table did not).

const WEEK = resolveWeekPeriod(new Date(2026, 5, 17, 14, 0, 0).getTime()); // Mon Jun 8 – Sun Jun 14
const MONTH = resolveMonthPeriod(new Date(2026, 5, 17, 9, 0, 0).getTime()); // May 2026

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('reviewPeriodLabel', () => {
  it('names the month in English', () => {
    expect(reviewPeriodLabel(MONTH)).toBe('May');
  });

  it('names the month in Swedish, lowercase', async () => {
    await i18n.changeLanguage('sv');
    expect(reviewPeriodLabel(MONTH)).toBe('maj');
  });

  it('never leaks the raw period id', async () => {
    await i18n.changeLanguage('sv');
    expect(reviewPeriodLabel(WEEK)).not.toContain(WEEK.id);
  });

  it('spans the week from its first to its last day (end is exclusive)', () => {
    const label = reviewPeriodLabel(WEEK);
    expect(label).toContain('8');
    expect(label).toContain('14');
    expect(label).not.toContain('15');
  });

  it('formats the Swedish week without an English month name', async () => {
    await i18n.changeLanguage('sv');
    const label = reviewPeriodLabel(WEEK);
    expect(label.toLowerCase()).toContain('jun');
    expect(label).not.toContain('Jun');
  });
});
