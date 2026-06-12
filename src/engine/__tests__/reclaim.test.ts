import { reclaimDividendMinutes, formatReclaim } from '../reclaim';

describe('reclaimDividendMinutes', () => {
  it('credits the under-estimator when the honest number was closer', () => {
    expect(reclaimDividendMinutes(15, 32, 30)).toBe(15); // |32-15| - |32-30| = 17 - 2
  });
  it('credits the over-reserver too (calibration down still pays)', () => {
    expect(reclaimDividendMinutes(60, 35, 40)).toBe(20); // 25 - 5
  });
  it('never deposits a negative when the honest number was worse', () => {
    expect(reclaimDividendMinutes(30, 28, 55)).toBe(0); // max(0, 2 - 27)
  });
  it('is zero when the honest number equalled the guess (no help given)', () => {
    expect(reclaimDividendMinutes(20, 50, 20)).toBe(0); // 30 - 30
  });
});

describe('formatReclaim', () => {
  it('formats hours and minutes', () => { expect(formatReclaim(860)).toBe('14h 20m'); });
  it('drops the hour when under 60', () => { expect(formatReclaim(35)).toBe('35m'); });
});
