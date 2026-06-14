import { render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { HoneycombStrip } from '../HoneycombStrip';
import type { HoneycombCell } from '../Honeycomb';

const noop = () => {};

function cell(id: string, sharpness: number, tier: HoneycombCell['tier']): HoneycombCell {
  return { categoryId: id, label: id, sharpness, tier };
}

describe('HoneycombStrip', () => {
  it('shows the next-tier line driven by the LEAD (most-ripened) category', () => {
    render(
      <HoneycombStrip
        cells={[cell('a', 20, 'Setting'), cell('b', 67, 'Ripening')]}
        logs={5}
        onPress={noop}
      />,
    );

    // Lead = most-ripened (67 → Ripening); the next tier after it is Thickening.
    expect(screen.getByText(/to Thickening/)).toBeOnTheScreen();
    // Ripening band [64,82] = 5 logs → 5 pips, of which exactly one is filled at 67.
    expect(screen.getAllByTestId('honey-pip-full')).toHaveLength(1);
    expect(screen.getAllByTestId(/^honey-pip-(full|next|empty)$/)).toHaveLength(5);
  });

  it('emphasises the remaining-logs count', () => {
    render(<HoneycombStrip cells={[cell('a', 67, 'Ripening')]} logs={2} onPress={noop} />);
    // logsToNextTier(67) = ceil((82-67)/4) = 4.
    expect(screen.getByText(/^4 logs$/)).toBeOnTheScreen();
  });

  it('caps with a full comb and no next-tier line once Honest', () => {
    render(
      <HoneycombStrip
        cells={[cell('hi', 95, 'Honest'), cell('lo', 10, 'Raw')]}
        logs={3}
        onPress={noop}
      />,
    );

    expect(screen.getByText('Fully ripened')).toBeOnTheScreen();
    expect(screen.queryByText(/logs? to /)).toBeNull();
    // A satisfied full row — every pip lit, none empty.
    expect(screen.queryAllByTestId('honey-pip-empty')).toHaveLength(0);
    expect(screen.getAllByTestId('honey-pip-full').length).toBeGreaterThan(0);
  });

  it('renders without animation under reduced motion', () => {
    const spy = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);

    expect(() =>
      render(<HoneycombStrip cells={[cell('a', 67, 'Ripening')]} logs={2} onPress={noop} />),
    ).not.toThrow();
    expect(screen.getByText(/to Thickening/)).toBeOnTheScreen();

    spy.mockRestore();
  });
});
