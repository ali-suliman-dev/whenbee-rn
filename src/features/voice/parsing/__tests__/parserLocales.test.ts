import { getParserTable } from '../parserLocales';

describe('getParserTable', () => {
  it('returns the English table for "en"', () => {
    const table = getParserTable('en');
    expect(table).not.toBeNull();
    expect(table?.maxTitleWords).toBe(8);
  });

  it('returns the Swedish table for "sv"', () => {
    const table = getParserTable('sv');
    expect(table).not.toBeNull();
    expect(table?.fillerWords.has('typ')).toBe(true);
  });

  it('returns null for an unknown locale', () => {
    expect(getParserTable('de')).toBeNull();
  });
});
