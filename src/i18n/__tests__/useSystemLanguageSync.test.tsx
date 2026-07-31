import { render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import i18n from '../index';
import { useSystemLanguageSync } from '../useSystemLanguageSync';

jest.mock('../detectLanguage', () => ({ detectLanguage: jest.fn(() => 'sv') }));
jest.mock('../languagePreference', () => ({ getLanguagePreference: jest.fn(() => 'system') }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { detectLanguage } = require('../detectLanguage');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getLanguagePreference } = require('../languagePreference');

function Probe() {
  useSystemLanguageSync();
  return null;
}

/** Render the hook and hand back the AppState listener it registered. */
function mountAndGetListener(): (state: AppStateStatus) => void {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    handler: (state: AppStateStatus) => void,
  ) => {
    listeners.push(handler);
    return { remove: jest.fn() };
  }) as unknown as typeof AppState.addEventListener);
  render(<Probe />);
  const handler = listeners[0];
  if (!handler) throw new Error('hook registered no AppState listener');
  return handler;
}

describe('useSystemLanguageSync', () => {
  let changeLanguage: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getLanguagePreference.mockReturnValue('system');
    changeLanguage = jest
      .spyOn(i18n, 'changeLanguage')
      .mockImplementation(
        () => Promise.resolve() as unknown as ReturnType<typeof i18n.changeLanguage>,
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Read INSIDE each test: i18n is initialized by jest.setup's beforeAll, which
  // runs after this describe body is evaluated — at describe time `i18n.language`
  // is still undefined. Pick whichever supported language the instance is not
  // currently on, so the assertion is about the switch, not about which one.
  const otherLang = () => (i18n.language === 'sv' ? 'en' : 'sv');

  it('switches to the device language when the app returns to the foreground', () => {
    const target = otherLang();
    detectLanguage.mockReturnValue(target);
    mountAndGetListener()('active');
    expect(changeLanguage).toHaveBeenCalledWith(target);
  });

  it('does nothing while the app is backgrounded', () => {
    detectLanguage.mockReturnValue(otherLang());
    mountAndGetListener()('background');
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('leaves an explicit user override alone — the choice outranks the device', () => {
    getLanguagePreference.mockReturnValue('en');
    detectLanguage.mockReturnValue(otherLang());
    mountAndGetListener()('active');
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('does not re-issue a change when the device language already matches', () => {
    detectLanguage.mockReturnValue(i18n.language);
    mountAndGetListener()('active');
    expect(changeLanguage).not.toHaveBeenCalled();
  });
});
