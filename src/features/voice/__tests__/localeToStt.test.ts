import { appLangToSttLocale } from '../localeToStt';

describe('appLangToSttLocale', () => {
  it('maps supported app languages to BCP-47 STT locales', () => {
    expect(appLangToSttLocale('en')).toBe('en-US');
    expect(appLangToSttLocale('sv')).toBe('sv-SE');
  });
  it('falls back to en-US for unknown languages', () => {
    expect(appLangToSttLocale('de')).toBe('en-US');
  });
});
