import { biggestLever } from '../biggestLever';
import type { ContextSample } from '../context';

// Four samples per bucket clears ACCURACY_MIN_BUCKET; a big accuracy gap clears
// ACCURACY_MIN_GAP. ratio 1 = perfect (acc 100); ratio 2 = 50% over (acc ~50).
const tight = (n: number): ContextSample[] => Array.from({ length: n }, () => ({ value: 'am', ratio: 1 }));
const wide = (n: number): ContextSample[] => Array.from({ length: n }, () => ({ value: 'pm', ratio: 2 }));

describe('biggestLever', () => {
  it('returns null for no dimensions', () => {
    expect(biggestLever([])).toBeNull();
  });

  it('returns null when no dimension clears the gates', () => {
    // single bucket → correlateContext returns null
    expect(biggestLever([{ key: 'timeOfDay', samples: tight(4) }])).toBeNull();
  });

  it('surfaces a real lever (best vs worst bucket) with its dimension key', () => {
    const lever = biggestLever([
      { key: 'timeOfDay', samples: [...tight(4), ...wide(4)] },
    ]);
    expect(lever).not.toBeNull();
    expect(lever!.key).toBe('timeOfDay');
    expect(lever!.worstValue).toBe('pm');
    expect(lever!.gap).toBeGreaterThanOrEqual(12);
  });

  it('picks the dimension with the largest gap', () => {
    const small = [...tight(4), ...Array.from({ length: 4 }, () => ({ value: 'pm', ratio: 1.3 }))]; // smaller gap
    const big = [...tight(4), ...wide(4)]; // larger gap
    const lever = biggestLever([
      { key: 'reason', samples: small },
      { key: 'timeOfDay', samples: big },
    ]);
    expect(lever!.key).toBe('timeOfDay');
  });

  it('breaks ties by dimension order (first wins)', () => {
    const a = [...tight(4), ...wide(4)];
    const b = [...tight(4), ...wide(4)];
    const lever = biggestLever([
      { key: 'first', samples: a },
      { key: 'second', samples: b },
    ]);
    expect(lever!.key).toBe('first');
  });
});
