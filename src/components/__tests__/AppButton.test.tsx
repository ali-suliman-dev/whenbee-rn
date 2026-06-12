import { render, fireEvent, screen } from '@testing-library/react-native';
import { AppButton } from '../AppButton';
import { HonestNumber } from '../HonestNumber';
import { TierTrail } from '../TierTrail';

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

describe('TierTrail', () => {
  const nodes = [
    { label: 'Start', state: 'done' as const },
    { label: 'Train', state: 'now' as const },
    { label: 'Unlock', state: 'lock' as const },
  ];

  it('renders all node labels', () => {
    render(<TierTrail nodes={nodes} />);
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('Train')).toBeTruthy();
    expect(screen.getByText('Unlock')).toBeTruthy();
  });

  it('renders a single node without error', () => {
    render(<TierTrail nodes={[{ label: 'Solo', state: 'now' }]} />);
    expect(screen.getByText('Solo')).toBeTruthy();
  });
});
