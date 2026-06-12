import { render, fireEvent, screen } from '@testing-library/react-native';
import { AppButton } from '../AppButton';
describe('AppButton', () => {
  it('renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<AppButton label="Continue" onPress={onPress} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<AppButton label="Nope" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Nope'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
