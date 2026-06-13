import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { HoneycombStrip } from '../HoneycombStrip';
import type { HoneycombCell } from '../Honeycomb';

const noop = () => {};

function cell(id: string, sharpness: number, tier: HoneycombCell['tier']): HoneycombCell {
  return { categoryId: id, label: id, sharpness, tier };
}

describe('HoneycombStrip', () => {
  it('renders the title, the LEAD tier pill, and the next-tier line', () => {
    render(
      <HoneycombStrip
        cells={[cell('a', 20, 'Setting'), cell('b', 78, 'Ripening')]}
        logs={5}
        onPress={noop}
      />,
    );

    expect(screen.getByText('Your honeycomb')).toBeOnTheScreen();
    // Lead = most-ripened (78 → Ripening) drives the pill, not the 20-sharpness cell.
    expect(screen.getByText('Ripening')).toBeOnTheScreen();
    // …and the next tier after Ripening is Thickening.
    expect(screen.getByText(/to Thickening/)).toBeOnTheScreen();
  });

  it('aggregates on the most-ripened cell regardless of cell order', () => {
    render(
      <HoneycombStrip
        cells={[cell('hi', 95, 'Honest'), cell('lo', 10, 'Raw')]}
        logs={3}
        onPress={noop}
      />,
    );

    // Honest is the top tier → pill reads Honest and there is no next-tier line.
    expect(screen.getByText('Honest')).toBeOnTheScreen();
    expect(screen.queryByText(/logs? to /)).toBeNull();
  });

  it('caps visible combs at honeycomb.stripMax and shows a "+N" overflow tail', () => {
    const cells = Array.from({ length: 9 }, (_, i) => cell(`c${i}`, 50, 'Setting'));
    render(<HoneycombStrip cells={cells} logs={9} onPress={noop} />);

    // Exactly stripMax (6) cells render; the rest collapse into "+3".
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`honeycomb-cell-c${i}`)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId('honeycomb-cell-c6')).toBeNull();
    expect(screen.getByText('+3')).toBeOnTheScreen();
  });

  it('shows no "+N" tail when cells fit within the cap', () => {
    const cells = Array.from({ length: 4 }, (_, i) => cell(`c${i}`, 50, 'Setting'));
    render(<HoneycombStrip cells={cells} logs={4} onPress={noop} />);

    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`honeycomb-cell-c${i}`)).toBeOnTheScreen();
    }
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it('renders without animation under reduced motion', () => {
    const spy = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);

    expect(() =>
      render(<HoneycombStrip cells={[cell('a', 67, 'Ripening')]} logs={2} onPress={noop} />),
    ).not.toThrow();
    expect(screen.getByText('Your honeycomb')).toBeOnTheScreen();

    spy.mockRestore();
  });
});
