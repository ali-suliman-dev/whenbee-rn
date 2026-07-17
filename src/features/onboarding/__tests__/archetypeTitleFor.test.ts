import { archetypeTitleFor } from '@/src/features/onboarding/usePersonalize';

test('archetype title ladder', () => {
  expect(archetypeTitleFor(1.0)).toBe('The Steady Reader');
  expect(archetypeTitleFor(1.3)).toBe('The Gentle Optimist');
  expect(archetypeTitleFor(1.7)).toBe('The Sprint Optimist');
  expect(archetypeTitleFor(2.4)).toBe('The Dreamer');
});
