import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import Settings from '@/src/app/settings';
import { useSettingsStore } from '@/src/stores/settingsStore';

// Mock expo-router: `router` needs a push stub so the Re-take quiz row doesn't
// throw; `useFocusEffect` is not used in settings but mocking the whole module
// keeps the import clean and consistent with other screen tests.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

// Reset store state between tests to avoid cross-test contamination.
beforeEach(() => {
  useSettingsStore.getState().reset();
  jest.clearAllMocks();
});

describe('Settings screen', () => {
  it('edits the display name from settings', () => {
    const { getByLabelText } = render(<Settings />);
    fireEvent.changeText(getByLabelText('Your name'), 'Ali');
    expect(useSettingsStore.getState().displayName).toBe('Ali');
  });

  it('clears the display name when set to empty', () => {
    useSettingsStore.setState({ displayName: 'Ali' });
    const { getByLabelText } = render(<Settings />);
    fireEvent.changeText(getByLabelText('Your name'), '');
    expect(useSettingsStore.getState().displayName).toBeUndefined();
  });

  it('renders the re-take time-style quiz row', () => {
    const { getByLabelText } = render(<Settings />);
    expect(getByLabelText('Re-take time-style quiz')).toBeTruthy();
  });

  it('navigates to the archetype quiz when tapped', () => {
    const { getByLabelText } = render(<Settings />);
    fireEvent.press(getByLabelText('Re-take time-style quiz'));
    expect(router.push).toHaveBeenCalledWith('/(modals)/archetype-quiz');
  });
});
