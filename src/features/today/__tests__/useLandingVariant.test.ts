import { getLandingVariant, setLandingVariant, LANDING_VARIANT_KEY } from '@/src/features/today/useLandingVariant';
import { kv } from '@/src/lib/kv';

afterEach(() => kv.delete(LANDING_VARIANT_KEY));

test('defaults to the approved D headline', () => {
  expect(getLandingVariant()).toBe('d');
});

test('round-trips the alternate through KV', () => {
  setLandingVariant('dAlt');
  expect(getLandingVariant()).toBe('dAlt');
});

test('an unknown stored value falls back to D rather than rendering nothing', () => {
  kv.set(LANDING_VARIANT_KEY, 'nonsense');
  expect(getLandingVariant()).toBe('d');
});
