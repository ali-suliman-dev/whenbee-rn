import { guessCategory, sortPickerCategories, tokenizeStems, type LearnedMap } from '../categoryGuess';
import type { PickerCategory } from '../CategoryChips';

describe('guessCategory', () => {
  it('maps email/reply text to admin', () => {
    expect(guessCategory('Reply to that email')).toBe('admin');
    expect(guessCategory('pay the electricity bill')).toBe('admin');
  });

  it('maps household text to cleaning', () => {
    expect(guessCategory('clean the kitchen')).toBe('cleaning');
    expect(guessCategory('fold the laundry')).toBe('cleaning');
  });

  it('maps meal text to cooking', () => {
    expect(guessCategory('cook dinner')).toBe('cooking');
  });

  it('maps shopping text to errands', () => {
    expect(guessCategory('buy groceries')).toBe('errands');
  });

  it('maps writing/design text to creative', () => {
    expect(guessCategory('write the blog post')).toBe('creative');
  });

  it('maps grooming text to getting_ready', () => {
    expect(guessCategory('get ready for work')).toBe('getting_ready');
  });

  it('returns null for empty or unrecognised text', () => {
    expect(guessCategory('')).toBeNull();
    expect(guessCategory('   ')).toBeNull();
    expect(guessCategory('zxqw foobar')).toBeNull();
  });

  it('picks the highest-scoring category when multiple keywords appear', () => {
    // "email" (admin) + "reply" (admin) outscore a lone "buy"
    expect(guessCategory('reply to email then buy stamps')).toBe('admin');
  });
});

describe('tokenizeStems', () => {
  it('lowercases, splits, and drops stopwords', () => {
    expect(tokenizeStems('Reply TO that Email')).toEqual(['reply', 'email']);
  });

  it('stems common variants to a shared root', () => {
    expect(tokenizeStems('emailing emails emailed')).toEqual(['email', 'email', 'email']);
    expect(tokenizeStems('cleaning cleaned')).toEqual(['clean', 'clean']);
    expect(tokenizeStems('groceries')).toEqual(['grocery']);
  });

  it('does not over-stem short words', () => {
    expect(tokenizeStems('is as')).toEqual([]); // both stopwords
    expect(tokenizeStems('buy gym')).toEqual(['buy', 'gym']); // len<4, untouched
  });

  it('returns empty for blank or punctuation-only input', () => {
    expect(tokenizeStems('   ')).toEqual([]);
    expect(tokenizeStems('!!! ???')).toEqual([]);
  });
});

describe('guessCategory with context', () => {
  const cat = (id: string, name: string) => ({ id, name, adaptSpeed: 'balanced' as const });

  it('still works built-in only when no context is passed', () => {
    expect(guessCategory('Reply to that email')).toBe('admin');
  });

  it('learned association beats the built-in keyword list', () => {
    // "email" would map to admin built-in, but the user has taught it → errands
    const learned: LearnedMap = { email: { errands: { count: 3, lastSeq: 9 } } };
    expect(
      guessCategory('forward the email', { learned, availableIds: ['admin', 'errands'] }),
    ).toBe('errands');
  });

  it('custom category name beats built-in when nothing is learned', () => {
    const namedCats = [cat('gym', 'Gym'), cat('admin', 'Admin & email')];
    expect(
      guessCategory('morning gym session', { namedCats, availableIds: ['gym', 'admin'] }),
    ).toBe('gym');
  });

  it('learned beats a custom-name match', () => {
    const learned: LearnedMap = { gym: { admin: { count: 2, lastSeq: 5 } } };
    const namedCats = [cat('gym', 'Gym'), cat('admin', 'Admin & email')];
    expect(
      guessCategory('gym', { learned, namedCats, availableIds: ['gym', 'admin'] }),
    ).toBe('admin');
  });

  it('breaks equal learned counts by most recent (higher lastSeq)', () => {
    const learned: LearnedMap = {
      walk: { errands: { count: 2, lastSeq: 4 }, getting_ready: { count: 2, lastSeq: 8 } },
    };
    expect(
      guessCategory('walk', { learned, availableIds: ['errands', 'getting_ready'] }),
    ).toBe('getting_ready');
  });

  it('skips a learned id that is no longer available (deleted category)', () => {
    const learned: LearnedMap = { email: { ghost: { count: 5, lastSeq: 9 } } };
    // ghost not in availableIds → falls through to built-in → admin
    expect(guessCategory('email', { learned, availableIds: ['admin'] })).toBe('admin');
  });

  it('returns null for an all-stopword title', () => {
    expect(guessCategory('to the')).toBeNull();
  });
});

describe('sortPickerCategories', () => {
  const cats: PickerCategory[] = [
    { id: 'admin', name: 'Admin', adaptSpeed: 'balanced' },
    { id: 'errands', name: 'Errands', adaptSpeed: 'balanced' },
    { id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' },
    { id: 'cooking', name: 'Cooking', adaptSpeed: 'balanced' },
  ];

  it('keeps incoming order when no usage and no guess', () => {
    expect(sortPickerCategories(cats, {}, null).map((c) => c.id)).toEqual([
      'admin',
      'errands',
      'cleaning',
      'cooking',
    ]);
  });

  it('sorts by descending usage', () => {
    const usage = { cooking: 5, errands: 2, admin: 1 };
    expect(sortPickerCategories(cats, usage, null).map((c) => c.id)).toEqual([
      'cooking',
      'errands',
      'admin',
      'cleaning',
    ]);
  });

  it('floats the guessed category to the front, even over a more-used one', () => {
    const usage = { cooking: 9 };
    expect(sortPickerCategories(cats, usage, 'admin').map((c) => c.id)[0]).toBe('admin');
  });

  it('does not mutate the input array', () => {
    const copy = [...cats];
    sortPickerCategories(cats, { cooking: 3 }, 'errands');
    expect(cats).toEqual(copy);
  });
});
