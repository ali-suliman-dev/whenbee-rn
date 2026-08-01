import i18n from '@/src/i18n';
import { categoryDisplayName, categoryName, isBuiltInCategory } from '../categoryName';

// The engine ships CATEGORY_NAMES in English and must stay i18n-free, so this
// resolver is the ONLY place a category id becomes words. These tests pin the two
// things that used to break: a built-in id rendering English to a Swedish reader,
// and a stored English label surviving a language change forever.

async function inSwedish(run: () => void): Promise<void> {
  await i18n.changeLanguage('sv');
  try {
    run();
  } finally {
    await i18n.changeLanguage('en');
  }
}

test('built-in ids resolve through the categories namespace', () => {
  expect(categoryName('admin')).toBe('Admin & email');
  expect(categoryName('getting_ready')).toBe('Getting ready');
});

test('built-in ids follow the active language', async () => {
  await inSwedish(() => {
    expect(categoryName('admin')).toBe('Admin & mejl');
    expect(categoryName('getting_ready')).toBe('Göra sig i ordning');
  });
});

test('a user-authored category is never translated, only title-cased', async () => {
  expect(categoryName('deep_work')).toBe('Deep Work');
  await inSwedish(() => {
    expect(categoryName('deep_work')).toBe('Deep Work');
  });
});

test('isBuiltInCategory covers the onboarding seed set', () => {
  expect(isBuiltInCategory('out_the_door')).toBe(true);
  expect(isBuiltInCategory('creative')).toBe(true);
  expect(isBuiltInCategory('deep_work')).toBe(false);
});

test('a stored English default is re-localized, not echoed', async () => {
  await inSwedish(() => {
    // What onboarding persisted before this fix.
    expect(categoryDisplayName('admin', 'Admin & email')).toBe('Admin & mejl');
    expect(categoryDisplayName('getting_ready', 'Getting ready')).toBe('Göra sig i ordning');
  });
});

test('a stored Swedish default re-localizes when the user switches back', () => {
  expect(categoryDisplayName('admin', 'Admin & mejl')).toBe('Admin & email');
});

test('a name the user typed always wins, in every language', async () => {
  expect(categoryDisplayName('admin', 'Inbox zero')).toBe('Inbox zero');
  expect(categoryDisplayName('deep_work', 'Deep work')).toBe('Deep work');
  await inSwedish(() => {
    expect(categoryDisplayName('admin', 'Inbox zero')).toBe('Inbox zero');
    expect(categoryDisplayName('deep_work', 'Deep work')).toBe('Deep work');
  });
});

test('a blank stored name falls back to the localized catalog name', () => {
  expect(categoryDisplayName('cooking', '')).toBe('Cooking');
  expect(categoryDisplayName('cooking', '   ')).toBe('Cooking');
  expect(categoryDisplayName('cooking', null)).toBe('Cooking');
});
