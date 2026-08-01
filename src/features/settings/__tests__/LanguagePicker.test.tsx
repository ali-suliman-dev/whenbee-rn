import { render, fireEvent } from '@testing-library/react-native';

const mockSetLanguagePreference = jest.fn();
let mockPreference: 'system' | 'en' | 'sv' = 'system';
jest.mock('@/src/i18n/languagePreference', () => ({
  getLanguagePreference: () => mockPreference,
  setLanguagePreference: (v: string) => mockSetLanguagePreference(v),
}));

const mockDetectLanguage = jest.fn(() => 'en' as 'en' | 'sv');
jest.mock('@/src/i18n/detectLanguage', () => ({
  detectLanguage: () => mockDetectLanguage(),
}));

/* eslint-disable import/first */
import i18n from '@/src/i18n';
import { LanguagePicker } from '../LanguagePicker';
/* eslint-enable import/first */

// Spied AFTER the global `initI18n()` beforeAll (jest.setup.js) has already run —
// i18next's own `.init()` awaits its real `changeLanguage` internally (callback
// style), so replacing it before init completes hangs the suite forever.
let mockChangeLanguage: jest.SpyInstance;
beforeAll(() => {
  mockChangeLanguage = jest.spyOn(i18n, 'changeLanguage').mockImplementation(
    () => Promise.resolve() as unknown as ReturnType<typeof i18n.changeLanguage>,
  );
});

beforeEach(() => {
  mockChangeLanguage.mockClear();
  mockSetLanguagePreference.mockClear();
  mockDetectLanguage.mockClear();
  mockPreference = 'system';
  mockDetectLanguage.mockReturnValue('en');
});

describe('LanguagePicker', () => {
  it('opens the sheet and selecting Svenska sets preference + changes language', () => {
    const { getByRole, getByText } = render(<LanguagePicker />);

    fireEvent.press(getByRole('button', { name: /language/i }));
    fireEvent.press(getByText('Svenska'));

    expect(mockSetLanguagePreference).toHaveBeenCalledWith('sv');
    expect(mockChangeLanguage).toHaveBeenCalledWith('sv');
  });

  it('selecting System default sets preference to system and changes to the detected language', () => {
    mockDetectLanguage.mockReturnValue('sv');
    const { getByRole, getAllByText } = render(<LanguagePicker />);

    fireEvent.press(getByRole('button', { name: /language/i }));
    const matches = getAllByText('System default');
    fireEvent.press(matches[matches.length - 1] as unknown as never);

    expect(mockSetLanguagePreference).toHaveBeenCalledWith('system');
    expect(mockChangeLanguage).toHaveBeenCalledWith('sv');
  });

  it('selecting English sets preference + changes language to en', () => {
    const { getByRole, getByText } = render(<LanguagePicker />);

    fireEvent.press(getByRole('button', { name: /language/i }));
    fireEvent.press(getByText('English'));

    expect(mockSetLanguagePreference).toHaveBeenCalledWith('en');
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Wiring guard.
//
// Every test above renders <LanguagePicker /> directly, so they all stayed green
// while a merge silently dropped the component from the Settings screen — the
// control existed, worked, and was unreachable. Assert the screen actually
// mounts it. A source check rather than a full screen render: settings.tsx pulls
// in the whole store/provider tree, and this only needs to answer "is it wired".
// ──────────────────────────────────────────────────────────────────────────────
describe('Settings wiring', () => {
  it('renders the language picker on the Settings screen', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path');
    const settings = readFileSync(
      join(__dirname, '..', '..', '..', 'app', 'settings.tsx'),
      'utf8',
    );
    expect(settings).toContain('<LanguagePicker />');
    expect(settings).toMatch(/import \{ LanguagePicker \} from/);
  });
});
