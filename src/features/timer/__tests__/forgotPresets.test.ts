import { buildForgotPresets } from '../forgotPresets';

describe('buildForgotPresets', () => {
  it('returns both presets when elapsed is well past 15m', () => {
    expect(buildForgotPresets(32)).toEqual([
      { offsetMin: 5, actualMin: 27 },
      { offsetMin: 15, actualMin: 17 },
    ]);
  });

  it('floors a fractional elapsed before subtracting', () => {
    expect(buildForgotPresets(32.9)).toEqual([
      { offsetMin: 5, actualMin: 27 },
      { offsetMin: 15, actualMin: 17 },
    ]);
  });

  it('drops a preset whose corrected actual would be < 1m', () => {
    // elapsed 16 → 5-ago = 11 (ok), 15-ago = 1 (ok)
    expect(buildForgotPresets(16)).toEqual([
      { offsetMin: 5, actualMin: 11 },
      { offsetMin: 15, actualMin: 1 },
    ]);
    // elapsed 15 → 15-ago = 0 (dropped)
    expect(buildForgotPresets(15)).toEqual([{ offsetMin: 5, actualMin: 10 }]);
  });

  it('returns [] when elapsed is under 6m (no valid preset)', () => {
    expect(buildForgotPresets(5)).toEqual([]);
    expect(buildForgotPresets(0)).toEqual([]);
  });
});
