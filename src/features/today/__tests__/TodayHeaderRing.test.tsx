import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { TodayHeaderRing } from '../TodayHeaderRing';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

describe('TodayHeaderRing', () => {
  beforeEach(() => (router.push as jest.Mock).mockClear());

  it('shows the tier word caption', () => {
    const { getByText } = render(
      <TodayHeaderRing sharpness={40} tier="Ripening" stage={3} seed={1} />,
    );
    expect(getByText('Getting closer')).toBeTruthy();
  });

  it('routes to the whenbee hub on press', () => {
    const { getByLabelText } = render(
      <TodayHeaderRing sharpness={40} tier="Ripening" stage={3} seed={1} />,
    );
    fireEvent.press(getByLabelText(/Calibration: Getting closer/i));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/whenbee');
  });
});
