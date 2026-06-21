import { maturityMeter } from '@/src/features/category-detail/maturity';

describe('maturityMeter', () => {
  it('lights one cell per log, capped at the honest threshold (6)', () => {
    expect(maturityMeter(2, 'setting')).toEqual({
      filled: 2, total: 6, runsLeft: 4, settledButNoisy: false,
    });
  });

  it('n=0 is all empty with full runsLeft', () => {
    expect(maturityMeter(0, 'raw')).toEqual({
      filled: 0, total: 6, runsLeft: 6, settledButNoisy: false,
    });
  });

  it('caps filled and clamps runsLeft to 0 at/above threshold', () => {
    expect(maturityMeter(8, 'setting')).toEqual({
      filled: 6, total: 6, runsLeft: 0, settledButNoisy: true,
    });
  });

  it('honest at threshold is not "settledButNoisy"', () => {
    expect(maturityMeter(6, 'honest')).toEqual({
      filled: 6, total: 6, runsLeft: 0, settledButNoisy: false,
    });
  });
});
