import { slugify, ONBOARDING_CATEGORIES } from '../categories';

describe('slugify', () => {
  it('lowercases and underscores non-alphanumerics', () => {
    expect(slugify('Out the door')).toBe('out_the_door');
    expect(slugify('Admin & Email')).toBe('admin_email');
  });

  it('collapses runs and trims edge separators', () => {
    expect(slugify('  Deep  Work!! ')).toBe('deep_work');
    expect(slugify('—weird—')).toBe('weird');
  });

  it('returns empty string for punctuation-only input', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('ONBOARDING_CATEGORIES', () => {
  it('offers the six seed categories with the spec ids', () => {
    expect(ONBOARDING_CATEGORIES.map((c) => c.id)).toEqual([
      'getting_ready',
      'cleaning',
      'admin',
      'errands',
      'cooking',
      'out_the_door',
    ]);
  });
});
