import {
  nudgeThresholdMin,
  closeThresholdMin,
  autoCloseDecision,
} from '../autoClose';
import { GUARDRAIL_MIN_THRESHOLD_MIN, FORGOT_GRACE_MIN } from '../constants';

describe('nudgeThresholdMin', () => {
  it('is honest × preset factor, floored at the guardrail minimum', () => {
    expect(nudgeThresholdMin({ honestMin: 60, stepIn: 'balanced' })).toBe(90);
    expect(nudgeThresholdMin({ honestMin: 60, stepIn: 'early' })).toBe(75);
    expect(nudgeThresholdMin({ honestMin: 60, stepIn: 'room' })).toBe(120);
    // 10 × 1.25 = 12.5 → below the 25-min floor → floored
    expect(nudgeThresholdMin({ honestMin: 10, stepIn: 'early' })).toBe(
      GUARDRAIL_MIN_THRESHOLD_MIN,
    );
  });

  it('returns null for an unusable honest number', () => {
    expect(nudgeThresholdMin({ honestMin: 0, stepIn: 'balanced' })).toBeNull();
    expect(nudgeThresholdMin({ honestMin: -3, stepIn: 'balanced' })).toBeNull();
    expect(nudgeThresholdMin({ honestMin: NaN, stepIn: 'balanced' })).toBeNull();
  });
});

describe('closeThresholdMin', () => {
  it('is the nudge threshold plus the grace window', () => {
    expect(closeThresholdMin({ honestMin: 60, stepIn: 'balanced' })).toBe(
      90 + FORGOT_GRACE_MIN,
    );
  });
  it('returns null when the nudge threshold is null', () => {
    expect(closeThresholdMin({ honestMin: 0, stepIn: 'balanced' })).toBeNull();
  });
});

describe('autoCloseDecision', () => {
  const base = { honestMin: 60, stepIn: 'balanced' as const };

  it('does not auto-close before the close threshold', () => {
    expect(autoCloseDecision({ ...base, elapsedMin: 100 }).shouldAutoClose).toBe(false);
  });

  it('auto-closes once elapsed passes the close threshold', () => {
    // close threshold = 90 + 20 = 110
    const d = autoCloseDecision({ ...base, elapsedMin: 111 });
    expect(d.shouldAutoClose).toBe(true);
  });

  it('recovers the PREDICTED honest finish, never the runaway elapsed', () => {
    const d = autoCloseDecision({ ...base, elapsedMin: 600 });
    expect(d.recoveredActualMin).toBe(60); // honest, not 600
  });

  it('never auto-closes when the honest number is unusable', () => {
    expect(
      autoCloseDecision({ honestMin: 0, stepIn: 'balanced', elapsedMin: 999 })
        .shouldAutoClose,
    ).toBe(false);
  });
});
