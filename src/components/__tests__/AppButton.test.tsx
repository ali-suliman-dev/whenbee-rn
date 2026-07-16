import { render, fireEvent, screen } from '@testing-library/react-native';
import { AppButton } from '../AppButton';
import { HonestNumber } from '../HonestNumber';
import { tokens } from '@/src/theme/tokens';

// Component tests resolve the theme via useColorMode(): settingsStore defaults
// colorMode to 'system' and react-native's mocked useColorScheme() returns
// null under jest, which falls back to 'light' — so assertions here use the
// LIGHT palette, not dark (the brief's snippet assumed dark; verified via a
// throwaway probe render that logged tokens.colors.light.primary === the
// resolved indigo face).
const faceOf = (tree: ReturnType<typeof render>) =>
  tree.getByTestId('appbutton-face').props.style;
const flat = (s: unknown): Record<string, unknown> =>
  Object.assign({}, ...([s].flat(Infinity).filter(Boolean) as object[]));

describe('AppButton disabled treatment', () => {
  it('mutes the FACE to the disabled token, not the live primary', () => {
    const tree = render(<AppButton label="Next" variant="indigo" disabled onPress={() => {}} />);
    expect(flat(faceOf(tree)).backgroundColor).toBe(tokens.colors.light.controlDisabled);
  });

  it('keeps the label at full opacity (the face carries the disabled signal)', () => {
    const tree = render(<AppButton label="Next" variant="indigo" disabled onPress={() => {}} />);
    expect(flat(tree.getByTestId('appbutton-content').props.style).opacity).toBe(1);
  });

  it('uses the live primary face when enabled', () => {
    const tree = render(<AppButton label="Next" variant="indigo" onPress={() => {}} />);
    expect(flat(faceOf(tree)).backgroundColor).toBe(tokens.colors.light.primary);
  });

  it('still marks itself disabled to assistive tech', () => {
    const tree = render(<AppButton label="Next" disabled onPress={() => {}} />);
    expect(tree.getByRole('button').props.accessibilityState).toEqual({ disabled: true });
  });
});

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

  it('variant="amber" renders its label and fires onPress', () => {
    const onPress = jest.fn();
    render(<AppButton label="Unlock" onPress={onPress} variant="amber" />);
    fireEvent.press(screen.getByText('Unlock'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('legacy variant="primary" renders without error', () => {
    const onPress = jest.fn();
    render(<AppButton label="Start" onPress={onPress} variant="primary" />);
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('legacy variant="secondary" renders without error', () => {
    const onPress = jest.fn();
    render(<AppButton label="Close" onPress={onPress} variant="secondary" />);
    expect(screen.getByText('Close')).toBeTruthy();
  });
});

describe('HonestNumber', () => {
  it('renders value', () => {
    render(<HonestNumber value="42" />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders value + unit', () => {
    render(<HonestNumber value="15" unit="min" />);
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('min')).toBeTruthy();
  });

  it('renders xl size', () => {
    render(<HonestNumber value="100" unit="×" size="xl" tone="indigo" />);
    expect(screen.getByText('100')).toBeTruthy();
  });
});
