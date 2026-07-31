import { statedFocusBlock } from '../statedFocusBlock';
import * as C from '@/src/engine/constants';

describe('statedFocusBlock', () => {
  it('returns null when the question was not answered', () => {
    expect(statedFocusBlock(undefined)).toBeNull();
  });

  it('returns null for "it varies" — no claim to make', () => {
    expect(statedFocusBlock('varies')).toBeNull();
  });

  it('puts the morning block in the morning', () => {
    const b = statedFocusBlock('morning')!;
    expect(b.startMin).toBeGreaterThanOrEqual(C.FW_WAKING_START_MIN);
    expect(b.endMin).toBeLessThanOrEqual(12 * 60);
    expect(b.startMin).toBeLessThan(b.endMin);
  });

  it('puts the evening block after midday', () => {
    const b = statedFocusBlock('evening')!;
    expect(b.startMin).toBeGreaterThanOrEqual(12 * 60);
    expect(b.endMin).toBeLessThanOrEqual(C.FW_WAKING_END_MIN);
  });

  it('always marks itself as stated, never learned', () => {
    expect(statedFocusBlock('morning')!.source).toBe('stated');
    expect(statedFocusBlock('evening')!.source).toBe('stated');
  });
});
