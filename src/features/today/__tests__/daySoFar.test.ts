import { daySoFarVisible, countLine, minutesPhrase, milestoneText } from '../daySoFar';

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

describe('minutesPhrase', () => {
  it('singular for exactly one minute', () => {
    expect(minutesPhrase(1)).toBe('1 real minute');
  });
  it('pluralizes for zero or more than one', () => {
    expect(minutesPhrase(0)).toBe('0 real minutes');
    expect(minutesPhrase(2)).toBe('2 real minutes');
    expect(minutesPhrase(145)).toBe('145 real minutes');
  });
});

describe('milestoneText', () => {
  it('reads the count-down to the next tier when one exists', () => {
    expect(milestoneText('Deep Work', 3)).toEqual({
      text: '~3 more logs and Deep Work settles in.',
      boldPrefix: '~3 more logs',
    });
  });
  it('singular-safe at k=1 (still "logs", not "log" — matches spec copy exactly)', () => {
    expect(milestoneText('Errands', 1)).toEqual({
      text: '~1 more logs and Errands settles in.',
      boldPrefix: '~1 more logs',
    });
  });
  it('falls back to the top-tier line when there is no next tier (k <= 0)', () => {
    expect(milestoneText('Deep Work', 0)).toEqual({
      text: 'Every log keeps Deep Work sharp.',
      boldPrefix: null,
    });
  });
});
