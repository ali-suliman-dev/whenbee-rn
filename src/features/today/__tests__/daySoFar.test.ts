import { daySoFarVisible, countLine, gapMilestone } from '../daySoFar';

describe('daySoFarVisible', () => {
  // All 8 combinations of the 3 booleans (unfinishedCount and completedCount are
  // treated as boolean-shaped inputs here: 0 vs >0).
  it.each([
    // [isTimerRunning, unfinishedCount, completedCount, expected]
    [false, 0, 1, true], // the only visible combo
    [false, 0, 0, false],
    [false, 1, 1, false],
    [false, 1, 0, false],
    [true, 0, 1, false],
    [true, 0, 0, false],
    [true, 1, 1, false],
    [true, 1, 0, false],
  ])(
    'isTimerRunning=%s, unfinishedCount=%s, completedCount=%s -> %s',
    (isTimerRunning, unfinishedCount, completedCount, expected) => {
      expect(daySoFarVisible(isTimerRunning, unfinishedCount, completedCount)).toBe(expected);
    },
  );

  it('stays visible with a larger completed count and still-zero unfinished', () => {
    expect(daySoFarVisible(false, 0, 5)).toBe(true);
  });
});

describe('countLine', () => {
  it('singular for exactly one log', () => {
    expect(countLine(1)).toBe('One honest log in.');
  });
  it('pluralizes for more than one', () => {
    expect(countLine(2)).toBe('2 honest logs in.');
    expect(countLine(11)).toBe('11 honest logs in.');
  });
});

describe('gapMilestone', () => {
  it('frames an over-guess day as the gap Whenbee is learning (amber fact, no scold)', () => {
    expect(gapMilestone(100, 130)).toEqual({
      text: "+30m over your guess today — that gap is what Whenbee's learning.",
      boldPrefix: '+30m over',
    });
  });
  it('formats the over gap in h/m for longer overruns', () => {
    expect(gapMilestone(60, 155)).toEqual({
      text: "+1h 35m over your guess today — that gap is what Whenbee's learning.",
      boldPrefix: '+1h 35m over',
    });
  });
  it('celebrates an under-guess day', () => {
    expect(gapMilestone(120, 90)).toEqual({
      text: '30m under your guess today — nicely called.',
      boldPrefix: '30m under',
    });
  });
  it('reads spot-on with no bold span when guess equals honest', () => {
    expect(gapMilestone(45, 45)).toEqual({
      text: 'Spot on your guess today.',
      boldPrefix: null,
    });
  });
});
