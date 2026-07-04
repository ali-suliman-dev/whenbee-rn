import i18n from '@/src/i18n';
import { copyFor, isTrigger, getStackRows } from '../paywallCopy';

describe('paywallCopy', () => {
  const t = i18n.getFixedT('en', 'paywall');

  it('isTrigger accepts known triggers and rejects junk', () => {
    expect(isTrigger('goals')).toBe(true);
    expect(isTrigger('make_day_honest')).toBe(true);
    expect(isTrigger('nope')).toBe(false);
    expect(isTrigger(undefined)).toBe(false);
  });

  it('pre framing is trigger-specific (goals leads coach, calendar leads calendar)', () => {
    const goals = copyFor(t, 'goals', 'pre');
    expect(goals.lead).toBe('coach');
    expect(goals.proof).toBe('coach');
    expect(goals.title.length).toBeGreaterThan(0);

    const cal = copyFor(t, 'make_day_honest', 'pre');
    expect(cal.lead).toBe('calendar');
    expect(cal.proof).toBe('calendar');
  });

  it('honest framing overrides the title to the earned line but keeps trigger lead/proof', () => {
    const c = copyFor(t, 'goals', 'honest');
    expect(c.title).toBe(t('honest.title'));
    expect(c.lead).toBe('coach');
  });

  it('every trigger resolves to an existing stack key', () => {
    const keys = new Set(getStackRows(t).map((r) => r.key));
    (['make_day_honest','settings_upgrade','steals_your_time','pro_reveal','pro_preview','goals','focus_window','hyperfocus_guard','pdf_export','routines','review_ritual','calendar_export','persistent_presence','day_capacity','honest_range'] as const)
      .forEach((tr) => expect(keys.has(copyFor(t, tr, 'pre').lead)).toBe(true));
  });

  it('eyebrow is the constant Pro label', () => {
    expect(copyFor(t, 'routines', 'pre').eyebrow).toBe('WHENBEE PRO');
  });
});
