import { daySoFarVisible, gapMilestone } from '../daySoFar';

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

describe('gapMilestone', () => {
  it('reports an over-guess day as an over gap (a fact, never a scold)', () => {
    expect(gapMilestone(100, 130)).toEqual({ direction: 'over', gapMin: 30 });
  });
  it('keeps the raw gap in minutes so the view can format it per locale', () => {
    expect(gapMilestone(60, 155)).toEqual({ direction: 'over', gapMin: 95 });
  });
  it('reports an under-guess day', () => {
    expect(gapMilestone(120, 90)).toEqual({ direction: 'under', gapMin: 30 });
  });
  it('reports spot-on with a zero gap when guess equals honest', () => {
    expect(gapMilestone(45, 45)).toEqual({ direction: 'equal', gapMin: 0 });
  });
});
