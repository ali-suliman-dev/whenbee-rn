import { spokenText } from '../a11yText';

describe('spokenText', () => {
  it('strips a trailing decorative ✦ and the space before it', () => {
    expect(spokenText('Calibrated ✦')).toBe('Calibrated');
    expect(spokenText('Kalibrerad ✦')).toBe('Kalibrerad');
  });

  it('leaves a sentence with no decorative glyph untouched', () => {
    expect(spokenText('5 more logs sharpen Honest-Day forecast when you plan')).toBe(
      '5 more logs sharpen Honest-Day forecast when you plan',
    );
  });

  it('leaves an empty string empty', () => {
    expect(spokenText('')).toBe('');
  });
});
