import { render, fireEvent } from '@testing-library/react-native';
import { ForgotStopSheet } from '../ForgotStopSheet';

// Mock the wheel to a button that emits a fixed finish ms via onChange, so the
// picker-mode confirm can be asserted without driving a real drum scroll.
jest.mock('@/src/features/planner/FinishTimeWheel', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    FinishTimeWheel: ({ onChange }: { onChange: (ms: number) => void }) => (
      <Pressable testID="wheel" onPress={() => onChange(1_000 + 22 * 60_000)}>
        <Text>wheel</Text>
      </Pressable>
    ),
  };
});

const baseProps = {
  startedAt: 1_000,
  elapsedMin: 32,
  honestMin: 30,
  onConfirm: jest.fn(),
  onStillGoing: jest.fn(),
  onNotSure: jest.fn(),
};

describe('ForgotStopSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders both presets with corrected labels', () => {
    const { getByText } = render(<ForgotStopSheet {...baseProps} />);
    expect(getByText(/~5 min ago/)).toBeTruthy();
    expect(getByText(/27m/)).toBeTruthy();
    expect(getByText(/~15 min ago/)).toBeTruthy();
    expect(getByText(/17m/)).toBeTruthy();
  });

  it('pressing a preset confirms with startedAt + actualMin', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(<ForgotStopSheet {...baseProps} onConfirm={onConfirm} />);
    fireEvent.press(getByText(/~5 min ago/));
    expect(onConfirm).toHaveBeenCalledWith(1_000 + 27 * 60_000, 'preset');
  });

  it('"Pick the exact time" reveals the wheel and confirms its value', () => {
    const onConfirm = jest.fn();
    const { getByText, getByTestId } = render(<ForgotStopSheet {...baseProps} onConfirm={onConfirm} />);
    fireEvent.press(getByText(/pick the exact time/i));
    fireEvent.press(getByTestId('wheel')); // emits 1_000 + 22m
    fireEvent.press(getByText(/^Log /)); // confirm button
    expect(onConfirm).toHaveBeenCalledWith(1_000 + 22 * 60_000, 'wheel');
  });

  it('shows only the wheel path when no preset is valid (elapsed < 6)', () => {
    const { queryByText, getByText } = render(<ForgotStopSheet {...baseProps} elapsedMin={4} />);
    expect(queryByText(/min ago/)).toBeNull();
    expect(getByText(/pick the exact time/i)).toBeTruthy();
  });

  it('footer routes Still going and Not sure yet', () => {
    const onStillGoing = jest.fn();
    const onNotSure = jest.fn();
    const { getByText } = render(<ForgotStopSheet {...baseProps} onStillGoing={onStillGoing} onNotSure={onNotSure} />);
    fireEvent.press(getByText(/still going/i));
    fireEvent.press(getByText(/not sure yet/i));
    expect(onStillGoing).toHaveBeenCalled();
    expect(onNotSure).toHaveBeenCalled();
  });
});
