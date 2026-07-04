import { detectLanguage } from '../detectLanguage';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'sv', languageTag: 'sv-SE' }]),
}));
jest.mock('../languagePreference', () => ({
  getLanguagePreference: jest.fn(() => 'system'),
}));

describe('detectLanguage', () => {
  it('returns the device language when supported and preference is system', () => {
    expect(detectLanguage()).toBe('sv');
  });

  it('falls back to en for an unsupported device language', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require('expo-localization');
    getLocales.mockReturnValueOnce([{ languageCode: 'de', languageTag: 'de-DE' }]);
    expect(detectLanguage()).toBe('en');
  });

  it('honors an explicit user override over the device language', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLanguagePreference } = require('../languagePreference');
    getLanguagePreference.mockReturnValueOnce('en');
    expect(detectLanguage()).toBe('en');
  });
});
