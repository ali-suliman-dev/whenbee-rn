import { leadHoney } from '../leadHoney';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';

const cell = (sharpness: number, tier: HoneycombCell['tier']): HoneycombCell => ({
  categoryId: `c-${sharpness}`,
  label: 'x',
  sharpness,
  tier,
});

describe('leadHoney', () => {
  it('returns Raw / 0 for no cells', () => {
    expect(leadHoney([])).toEqual({ sharpness: 0, tier: 'Raw' });
  });

  it('returns the single cell unchanged', () => {
    expect(leadHoney([cell(40, 'Ripening')])).toEqual({ sharpness: 40, tier: 'Ripening' });
  });

  it('picks the most-ripened (max sharpness) cell as the lead', () => {
    const cells = [cell(20, 'Setting'), cell(72, 'Honest'), cell(55, 'Ripening')];
    expect(leadHoney(cells)).toEqual({ sharpness: 72, tier: 'Honest' });
  });
});
