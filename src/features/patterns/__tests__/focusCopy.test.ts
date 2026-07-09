import {
  whyNarrative,
  sessionsGateCopy,
  daysGateCopy,
  peakGateCopy,
  daysUpcomingCopy,
  peakUpcomingCopy,
  focusUnlockedTag,
  focusRewardCaption,
} from '../focusCopy';

describe('whyNarrative', () => {
  it('buckets <660 (before 11:00)', () => {
    expect(whyNarrative(659)).toBe('You start sharp and fade after lunch');
  });

  it('buckets <780 (11:00–13:00)', () => {
    expect(whyNarrative(660)).toBe('You hit your stride around midday');
    expect(whyNarrative(779)).toBe('You hit your stride around midday');
  });

  it('buckets <1020 (13:00–17:00)', () => {
    expect(whyNarrative(780)).toBe('Mornings warm up slow — you peak after lunch');
    expect(whyNarrative(1019)).toBe('Mornings warm up slow — you peak after lunch');
  });

  it('buckets the evening fallback (after 17:00)', () => {
    expect(whyNarrative(1020)).toBe("You're a slow burn — you peak in the evening");
    expect(whyNarrative(1400)).toBe("You're a slow burn — you peak in the evening");
  });

  it('every bucket string has no trailing period', () => {
    for (const min of [0, 659, 660, 779, 780, 1019, 1020, 1400]) {
      expect(whyNarrative(min).endsWith('.')).toBe(false);
    }
  });

  it('joining with a contrast clause never yields a double period or a clause after a period', () => {
    const contrast = 2.3;
    for (const min of [0, 700, 900, 1100]) {
      const contrastClause = `, ${contrast.toFixed(1)}× above your dip`;
      const sentence = `${whyNarrative(min)}${contrastClause}.`;
      expect(sentence).not.toContain('..');
      // ends with exactly one closing period (decimal points inside the
      // contrast number, e.g. "2.3", are fine — only the trailing "." counts)
      expect(sentence.endsWith('.')).toBe(true);
      expect(sentence.endsWith('..')).toBe(false);
    }
  });

  it('joining without a contrast clause never yields a double period', () => {
    for (const min of [0, 700, 900, 1100]) {
      const sentence = `${whyNarrative(min)}.`;
      expect(sentence).not.toContain('..');
      expect(sentence.endsWith('.')).toBe(true);
      expect(sentence.endsWith('..')).toBe(false);
    }
  });
});

describe('sessionsGateCopy', () => {
  it('done: value carries a check, no "to go" language', () => {
    expect(sessionsGateCopy(15, 15)).toEqual({
      valueText: '15 ✓',
      sub: 'Plenty logged for me to learn from.',
    });
    expect(sessionsGateCopy(18, 15).valueText).toBe('18 ✓');
  });

  it('active: shows have/need and pluralised remaining sessions', () => {
    expect(sessionsGateCopy(3, 15)).toEqual({
      valueText: '3/15',
      sub: '12 more timed sessions to go.',
    });
  });

  it('active: singular when exactly one session remains', () => {
    expect(sessionsGateCopy(14, 15).sub).toBe('1 more timed session to go.');
  });
});

describe('daysGateCopy', () => {
  it('done: value carries a check, sub names the day spread', () => {
    expect(daysGateCopy(6, 5)).toEqual({
      valueText: '6 ✓',
      sub: 'Spread over 6 days — not a one-day fluke.',
    });
  });

  it('active: pluralises remaining days', () => {
    expect(daysGateCopy(3, 5)).toEqual({
      valueText: '3/5',
      sub: '2 more days with a session logged.',
    });
  });

  it('active: singular when one day remains', () => {
    expect(daysGateCopy(4, 5).sub).toBe('1 more day with a session logged.');
  });
});

describe('peakGateCopy', () => {
  it('active (not confirming): pluralises remaining peak sessions', () => {
    expect(peakGateCopy(2, 6, false)).toEqual({
      valueText: '2/6',
      sub: '4 more sessions in your busiest stretch and your peak locks in.',
    });
  });

  it('active: singular when one peak session remains', () => {
    expect(peakGateCopy(5, 6, false).sub).toBe(
      '1 more session in your busiest stretch and your peak locks in.',
    );
  });

  it('confirming: full value, settling copy — never a "to go" line', () => {
    expect(peakGateCopy(8, 6, true)).toEqual({
      valueText: '6/6',
      sub: 'Confirming your peak — a session or two more will settle it.',
    });
  });
});

describe('upcoming copy', () => {
  it('days upcoming: muted, no shame', () => {
    expect(daysUpcomingCopy(0, 5)).toEqual({
      valueText: '0/5',
      sub: 'Next: a spread of different days.',
    });
  });

  it('peak upcoming: muted, last in line', () => {
    expect(peakUpcomingCopy(0, 6)).toEqual({
      valueText: '0/6',
      sub: 'Last: your busiest stretch stands out.',
    });
  });
});

describe('focusUnlockedTag', () => {
  it('counts unlocked gates out of three', () => {
    expect(focusUnlockedTag(0)).toBe('0 of 3 unlocked');
    expect(focusUnlockedTag(2)).toBe('2 of 3 unlocked');
  });
});

describe('focusRewardCaption', () => {
  it('one gate (or fewer) left → the single-signal reveal', () => {
    expect(focusRewardCaption(1)).toBe('One more signal reveals your sharpest hours.');
    expect(focusRewardCaption(0)).toBe('One more signal reveals your sharpest hours.');
  });

  it('more than one gate left → the keep-logging line', () => {
    expect(focusRewardCaption(2)).toBe('Keep logging — your sharpest hours are forming.');
    expect(focusRewardCaption(3)).toBe('Keep logging — your sharpest hours are forming.');
  });
});
