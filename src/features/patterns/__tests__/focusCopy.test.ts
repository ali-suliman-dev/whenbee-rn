import { whyNarrative } from '../focusCopy';

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
