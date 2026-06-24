import {
  startFinishTimeActivity,
  endFinishTimeActivity,
  isFinishTimeActivityActive,
} from '@/src/services/liveActivity';

describe('isFinishTimeActivityActive', () => {
  it('is false before start, true after start, false after end', () => {
    expect(isFinishTimeActivityActive()).toBe(false);
    startFinishTimeActivity({ taskLabel: 'Email', finishEpoch: 1000, startEpoch: 0, isProRich: false });
    expect(isFinishTimeActivityActive()).toBe(true);
    endFinishTimeActivity();
    expect(isFinishTimeActivityActive()).toBe(false);
  });
});
