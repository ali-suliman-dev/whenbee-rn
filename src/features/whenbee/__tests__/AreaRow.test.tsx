import { render, fireEvent } from '@testing-library/react-native';
import { AreaRow } from '../AreaRow';

describe('AreaRow', () => {
  it('renders the name and multiplier and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = render(
      <AreaRow name="Cleaning" multiplier={1.9} sharpness={60} onPress={onPress} />,
    );
    expect(getByText('Cleaning')).toBeTruthy();
    expect(getByText('1.9×')).toBeTruthy();
    fireEvent.press(getByLabelText('Cleaning insights'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('shows an em dash when no multiplier yet', () => {
    const { getByText } = render(<AreaRow name="Email" sharpness={0} onPress={() => {}} />);
    expect(getByText('—')).toBeTruthy();
  });
});
