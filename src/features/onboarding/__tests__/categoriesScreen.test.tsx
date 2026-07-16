import { render, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Categories from '@/src/app/(onboarding)/categories';
import { useOnboardingStore } from '@/src/stores/onboardingStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const pushMock = router.push as jest.Mock;

describe('Onboarding Step 1 — Pick tasks', () => {
  beforeEach(() => {
    pushMock.mockClear();
    useOnboardingStore.setState({ completed: false, picked: [], quizAnswers: {} });
  });

  it('gates Continue until at least one chip is selected', () => {
    render(<Categories />);

    // With nothing picked, the CTA is disabled — pressing does not advance.
    fireEvent.press(screen.getByText('Continue →'));
    expect(pushMock).not.toHaveBeenCalled();

    // Select a category, then the CTA advances.
    fireEvent.press(screen.getByText('Cleaning'));
    expect(useOnboardingStore.getState().picked.map((p) => p.id)).toEqual(['cleaning']);

    fireEvent.press(screen.getByText('Continue →'));
    expect(pushMock).toHaveBeenCalledWith('/(onboarding)/ready');
  });

  it('toggling a chip off re-disables Continue', () => {
    render(<Categories />);
    fireEvent.press(screen.getByText('Errands'));
    fireEvent.press(screen.getByText('Errands'));
    expect(useOnboardingStore.getState().picked).toEqual([]);

    fireEvent.press(screen.getByText('Continue →'));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('tells the user why Continue is disabled, and stops once they pick a category', () => {
    render(<Categories />);
    expect(screen.getByText('Pick at least one to continue')).toBeTruthy();

    fireEvent.press(screen.getByText('Cleaning'));
    expect(screen.queryByText('Pick at least one to continue')).toBeNull();
  });

  it('preselects the area the user named as their time sink', () => {
    useOnboardingStore.setState({ quizAnswers: { pace: 'lot', sink: 'chores' } });
    const tree = render(<Categories />);
    expect(tree.getByLabelText('Cleaning').props.accessibilityState.selected).toBe(true);
  });

  it('preselects nothing when sink was not answered', () => {
    useOnboardingStore.setState({ quizAnswers: { pace: 'lot' } });
    const tree = render(<Categories />);
    expect(tree.getByText('Pick at least one to continue')).toBeTruthy();
  });

  it('tells the user areas are editable later, naming the real path', () => {
    const tree = render(<Categories />);
    expect(tree.getByText('Change or remove these any time in the Whenbee tab.')).toBeTruthy();
  });

  it('double-tapping Continue advances only once', () => {
    render(<Categories />);
    fireEvent.press(screen.getByText('Cleaning'));
    const cta = screen.getByText('Continue →');
    fireEvent.press(cta);
    fireEvent.press(cta);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/(onboarding)/ready');
  });
});
