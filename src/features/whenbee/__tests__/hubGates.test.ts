// TDD: hubGates — pure visibility gates for the hub's gentle cards.
//
// Regression context (2026-07-23): both the drift re-check card and the
// blind-spot card rendered on a user's FIRST-ever log. Drift is the companion's
// stage-5 capability ("re-check when life shifts") and a blind spot needs
// contrast between areas — neither concept exists on day one.

import {
  driftRecheckVisible,
  blindSpotFor,
  DRIFT_RECHECK_MIN_STAGE,
  BLIND_SPOT_MIN_TRACKED_WITH_LOGS,
  BLIND_SPOT_MIN_ESTABLISHED_N,
} from '../hubGates';

const nameOf = (id: string) => id.toUpperCase();

describe('driftRecheckVisible — stage-5 capability, never before', () => {
  it('hidden while settled, at any stage', () => {
    expect(driftRecheckVisible({ driftHealth: 'settled', stage: 5, dismissed: false })).toBe(false);
    expect(driftRecheckVisible({ driftHealth: 'settled', stage: 1, dismissed: false })).toBe(false);
  });

  it('hidden when curious but below the capability stage (the first-log regression)', () => {
    expect(driftRecheckVisible({ driftHealth: 'curious', stage: 1, dismissed: false })).toBe(false);
    expect(driftRecheckVisible({ driftHealth: 'curious', stage: 4, dismissed: false })).toBe(false);
  });

  it('shows when curious at stage 5+ and not dismissed', () => {
    expect(driftRecheckVisible({ driftHealth: 'curious', stage: 5, dismissed: false })).toBe(true);
    expect(driftRecheckVisible({ driftHealth: 'curious', stage: 6, dismissed: false })).toBe(true);
  });

  it('dismissal hides it for the cycle', () => {
    expect(driftRecheckVisible({ driftHealth: 'curious', stage: 5, dismissed: true })).toBe(false);
  });

  it('the gate stage matches the companion capability ladder (drift-recalibration = stage 5)', () => {
    expect(DRIFT_RECHECK_MIN_STAGE).toBe(5);
  });
});

describe('blindSpotFor — needs contrast, never on day one', () => {
  const cats = (...ids: string[]) => ids.map((id) => ({ id }));

  it('null with no categories or no logs', () => {
    expect(blindSpotFor([], {}, nameOf)).toBeNull();
    expect(blindSpotFor(cats('a'), { a: { n: 0, sharpness: 0 } }, nameOf)).toBeNull();
  });

  it('null after the first-ever log — a single logged area is not a blind spot (regression)', () => {
    expect(blindSpotFor(cats('a'), { a: { n: 1, sharpness: 5 } }, nameOf)).toBeNull();
  });

  it('null even with many logs in ONE area — no second area to contrast against', () => {
    expect(blindSpotFor(cats('a', 'b'), { a: { n: 10, sharpness: 60 } }, nameOf)).toBeNull();
  });

  it('null when two areas have logs but neither is established yet', () => {
    expect(
      blindSpotFor(
        cats('a', 'b'),
        { a: { n: 2, sharpness: 20 }, b: { n: 1, sharpness: 5 } },
        nameOf,
      ),
    ).toBeNull();
  });

  it('surfaces the lowest-sharpness area once a second area is established', () => {
    const spot = blindSpotFor(
      cats('a', 'b'),
      { a: { n: 6, sharpness: 60 }, b: { n: 1, sharpness: 5 } },
      nameOf,
    );
    expect(spot).toEqual({ categoryId: 'b', name: 'B', sharpness: 5 });
  });

  it('picks the weakest among several logged areas', () => {
    const spot = blindSpotFor(
      cats('a', 'b', 'c'),
      {
        a: { n: 8, sharpness: 70 },
        b: { n: 3, sharpness: 25 },
        c: { n: 2, sharpness: 12 },
      },
      nameOf,
    );
    expect(spot?.categoryId).toBe('c');
  });

  it('gate constants: two logged areas, one established at n≥5', () => {
    expect(BLIND_SPOT_MIN_TRACKED_WITH_LOGS).toBe(2);
    expect(BLIND_SPOT_MIN_ESTABLISHED_N).toBe(5);
  });
});
