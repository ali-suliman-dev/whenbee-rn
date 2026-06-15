import { shouldBankDiscovery } from '../discovery';
import { INSIGHT_MIN_GAP } from '../constants';

describe('shouldBankDiscovery', () => {
  it('banks the first discovery for a category', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.9, lastBankedMultiplier: null })).toBe(true);
  });
  it('does not re-bank when unchanged', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.9, lastBankedMultiplier: 1.9 })).toBe(false);
  });
  it('does not re-bank for a sub-gap move', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 2.1, lastBankedMultiplier: 1.9 })).toBe(false);
  });
  it('re-banks at exactly the gap', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.9 + INSIGHT_MIN_GAP, lastBankedMultiplier: 1.9 })).toBe(true);
  });
  it('re-banks well beyond the gap', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 2.5, lastBankedMultiplier: 1.9 })).toBe(true);
  });
  it('is symmetric for a downward move', () => {
    expect(shouldBankDiscovery({ candidateMultiplier: 1.4, lastBankedMultiplier: 1.9 })).toBe(true);
  });
});
