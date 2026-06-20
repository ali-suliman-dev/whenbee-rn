import { render } from '@testing-library/react-native';
import { router } from 'expo-router';
import Welcome from '@/src/app/(onboarding)/welcome';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const pushMock = router.push as jest.Mock;

describe('Welcome screen', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  test('welcome shows hero, payoff, privacy, CTA', () => {
    const { getByText } = render(<Welcome />);
    expect(getByText(/time optimist/)).toBeTruthy();
    expect(getByText(/example/i)).toBeTruthy(); // OverflowBar caption
    expect(getByText(/stays on this phone/i)).toBeTruthy();
    expect(getByText(/Get started/)).toBeTruthy();
  });
});
