import { postLogQuality } from '../postLogQuality';

describe('postLogQuality', () => {
  it('is typical with no recent history', () => {
    expect(postLogQuality({ thisError: 0.1, recentErrors: [] })).toBe('typical');
  });

  it('is tightest_week when at or below the recent minimum', () => {
    expect(postLogQuality({ thisError: 0.05, recentErrors: [0.2, 0.3, 0.1] })).toBe('tightest_week');
    expect(postLogQuality({ thisError: 0.1, recentErrors: [0.2, 0.3, 0.1] })).toBe('tightest_week');
  });

  it('is tighter_than_usual when below the mean but not the min', () => {
    // mean of [0.1,0.5] = 0.3; thisError 0.2 is < mean, > min
    expect(postLogQuality({ thisError: 0.2, recentErrors: [0.1, 0.5] })).toBe('tighter_than_usual');
  });

  it('is typical when at or above the mean', () => {
    expect(postLogQuality({ thisError: 0.4, recentErrors: [0.1, 0.5] })).toBe('typical');
  });
});
