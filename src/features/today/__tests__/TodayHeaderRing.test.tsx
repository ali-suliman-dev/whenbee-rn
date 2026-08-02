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

  it('F14: drops the visible tier caption (CalibrationCard already says it), but still speaks it via a11y', () => {
    const { queryByText, getByLabelText } = render(
      <TodayHeaderRing sharpness={40} tier="Ripening" stage={3} seed={1} />,
    );
    expect(queryByText('Getting closer')).toBeNull();
    expect(getByLabelText(/Getting closer/i)).toBeTruthy();
  });

  it('routes to the whenbee hub on press', () => {
    const { getByLabelText } = render(
      <TodayHeaderRing sharpness={40} tier="Ripening" stage={3} seed={1} />,
    );
    fireEvent.press(getByLabelText(/Calibration: Getting closer/i));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/whenbee');
  });
});
