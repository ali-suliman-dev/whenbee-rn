import { proReadiness } from '../proReadiness';

describe('proReadiness', () => {
  it('pitch stays locked while confidence is raw', () => {
    const r = proReadiness({ leadConfidence: 'raw', totalCompletedLogs: 1 });
    expect(r.pitchUnlocked).toBe(false);
    expect(r.perFeatureReady['confidence-band']).toBe(false);
  });
  it('pitch unlocks the moment confidence reaches setting', () => {
    const r = proReadiness({ leadConfidence: 'setting', totalCompletedLogs: 3 });
    expect(r.pitchUnlocked).toBe(true);
    expect(r.perFeatureReady['confidence-band']).toBe(true);
  });
  it('day-capacity / honest-week need their log thresholds', () => {
    const few = proReadiness({ leadConfidence: 'setting', totalCompletedLogs: 3 });
    expect(few.perFeatureReady['day-capacity']).toBe(false);
    const many = proReadiness({ leadConfidence: 'honest', totalCompletedLogs: 14 });
    expect(many.perFeatureReady['day-capacity']).toBe(true);
    expect(many.perFeatureReady['honest-week']).toBe(true);
  });
});
