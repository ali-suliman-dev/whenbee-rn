import { shouldUseName } from '../nameDensity';

it('uses the name only at earned moments', () => {
  expect(shouldUseName('milestone')).toBe(true);
  expect(shouldUseName('return')).toBe(true);
  expect(shouldUseName('routine')).toBe(false);
  expect(shouldUseName('greeting')).toBe(false);
});
