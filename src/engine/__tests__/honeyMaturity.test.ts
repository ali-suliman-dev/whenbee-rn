import { effortFloor, honeyMaturity } from '../honeyMaturity';
import { HONEY_FLOOR_CAP, HONEY_SEAL_GATE } from '../constants';

describe('effortFloor', () => {
  it('is positive on the first log (no dead 0%)', () => {
    expect(effortFloor(1)).toBeGreaterThan(20);
  });
  it('strictly increases with n', () => {
    for (let n = 1; n < 30; n++) {
      expect(effortFloor(n + 1)).toBeGreaterThan(effortFloor(n));
    }
  });
  it('never reaches the cap (caps below Thickening asymptotically)', () => {
    expect(effortFloor(1000)).toBeLessThan(HONEY_FLOOR_CAP);
    expect(effortFloor(1000)).toBeGreaterThan(HONEY_FLOOR_CAP - 1);
  });
});

describe('honeyMaturity', () => {
  it('a perfect first guess does NOT seal (accuracy gated by low trust)', () => {
    const honey = honeyMaturity({ n: 1, accuracy: 100, prevHoney: 0, sealEligible: false });
    expect(honey).toBeGreaterThan(0);
    expect(honey).toBeLessThan(50);
  });
  it('never returns 0 for a counted log', () => {
    const honey = honeyMaturity({ n: 1, accuracy: 0, prevHoney: 0, sealEligible: false });
    expect(honey).toBeGreaterThan(0);
  });
  it('is monotonic — never drops below prevHoney', () => {
    const honey = honeyMaturity({ n: 5, accuracy: 0, prevHoney: 60, sealEligible: false });
    expect(honey).toBe(60);
  });
  it('cannot reach the seal gate when not seal-eligible', () => {
    const honey = honeyMaturity({ n: 100, accuracy: 100, prevHoney: 0, sealEligible: false });
    expect(honey).toBeLessThan(HONEY_SEAL_GATE);
  });
  it('can reach the seal gate only with high accuracy + eligibility + enough data', () => {
    const honey = honeyMaturity({ n: 25, accuracy: 100, prevHoney: 0, sealEligible: true });
    expect(honey).toBeGreaterThanOrEqual(HONEY_SEAL_GATE);
  });
  it('caps at exactly 92 (HONEY_SEAL_GATE - 1) when not seal-eligible, even at large n + perfect accuracy', () => {
    // With sealEligible:false the cap is HONEY_SEAL_GATE-1 = 92. A large-n perfect
    // input saturates the ramp so the result must land exactly on the cap.
    const honey = honeyMaturity({ n: 100, accuracy: 100, prevHoney: 0, sealEligible: false });
    expect(honey).toBe(92);
  });
  it('sealEligible:true but low n keeps honey below the gate (ramp not yet crossed)', () => {
    // n=6, accuracy=100, sealEligible=true → raw ≈ 80.75 (floor+trust blend not yet
    // strong enough to push past 93). Seal eligibility unlocks the ceiling but does
    // not teleport honey there instantly.
    const honey = honeyMaturity({ n: 6, accuracy: 100, prevHoney: 0, sealEligible: true });
    expect(honey).toBe(80.75);
    expect(honey).toBeLessThan(HONEY_SEAL_GATE);
  });
});
