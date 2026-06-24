import { guardrailFactor, guardrailThresholdMin } from '../guardrail';

describe('guardrailFactor', () => {
  it('off → null', () => expect(guardrailFactor('off')).toBeNull());
  it('maps each multiple', () => {
    expect(guardrailFactor('1.5x')).toBe(1.5);
    expect(guardrailFactor('2x')).toBe(2);
    expect(guardrailFactor('3x')).toBe(3);
  });
});

describe('guardrailThresholdMin', () => {
  it('off → null', () => expect(guardrailThresholdMin({ honestMin: 20, setting: 'off' })).toBeNull());
  it('honest 20, 2x → 40', () => expect(guardrailThresholdMin({ honestMin: 20, setting: '2x' })).toBe(40));
  it('honest 30, 1.5x → 45', () => expect(guardrailThresholdMin({ honestMin: 30, setting: '1.5x' })).toBe(45));
  it('floors below the 25-min minimum: honest 10, 2x (=20) → 25', () =>
    expect(guardrailThresholdMin({ honestMin: 10, setting: '2x' })).toBe(25));
  it('floors: honest 5, 3x (=15) → 25', () =>
    expect(guardrailThresholdMin({ honestMin: 5, setting: '3x' })).toBe(25));
  it('honest 0 → null', () => expect(guardrailThresholdMin({ honestMin: 0, setting: '2x' })).toBeNull());
  it('honest NaN → null', () => expect(guardrailThresholdMin({ honestMin: NaN, setting: '2x' })).toBeNull());
  it('no upper clamp: honest 200, 3x → 600', () =>
    expect(guardrailThresholdMin({ honestMin: 200, setting: '3x' })).toBe(600));
  it('rounds then floors: honest 17, 1.5x (=25.5) → 26', () =>
    expect(guardrailThresholdMin({ honestMin: 17, setting: '1.5x' })).toBe(26));
});
