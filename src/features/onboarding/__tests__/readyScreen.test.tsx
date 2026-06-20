import { render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Ready from '@/src/app/(onboarding)/ready';
import { useOnboardingStore } from '@/src/stores/onboardingStore';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const replaceMock = router.replace as jest.Mock;

describe('Onboarding Step 2 — Ready screen', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    useOnboardingStore.setState({ completed: false, picked: [] });
  });

  test('ready shows trail, no-guilt caption, promise, CTA', () => {
    render(<Ready />);
    expect(screen.getByText('Raw')).toBeTruthy();
    expect(screen.getByText(/no streak to break/i)).toBeTruthy();
    expect(screen.getByText(/Empty days are fine/i)).toBeTruthy();
    expect(screen.getByText(/Open my day/)).toBeTruthy();
  });
});
