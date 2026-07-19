import { copyFor, isTrigger } from '../paywallCopy';

describe('paywallCopy', () => {
  it('isTrigger accepts known triggers and rejects junk', () => {
    expect(isTrigger('goals')).toBe(true);
    expect(isTrigger('make_day_honest')).toBe(true);
    expect(isTrigger('nope')).toBe(false);
    expect(isTrigger(undefined)).toBe(false);
  });

  it('pre framing is trigger-specific', () => {
    const goals = copyFor('goals', 'pre');
    expect(goals.title).toBe('You set the aim. Now get a coach.');
    expect(goals.sub.length).toBeGreaterThan(0);

    const cal = copyFor('make_day_honest', 'pre');
    expect(cal.title).toBe('Your real day, before you live it.');
  });

  it('honest framing overrides title and sub to the earned lines', () => {
    const c = copyFor('goals', 'honest');
    expect(c.title).toBe('Your numbers are real now.');
    expect(c.sub).toContain('You did the logging');
  });

  it('every trigger resolves to non-empty copy', () => {
    (
      ['make_day_honest','settings_upgrade','steals_your_time','pro_reveal','pro_preview','goals','focus_window','hyperfocus_guard','pdf_export','routines','review_ritual','calendar_export','persistent_presence','day_capacity','honest_range'] as const
    ).forEach((tr) => {
      const c = copyFor(tr, 'pre');
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.sub.length).toBeGreaterThan(0);
    });
  });

  it('eyebrow is the constant Pro label', () => {
    expect(copyFor('routines', 'pre').eyebrow).toBe('WHENBEE PRO');
  });
});
