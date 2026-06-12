import { render, screen } from '@testing-library/react-native';
import { Honeycomb } from '../Honeycomb';

describe('Honeycomb', () => {
  it('exposes a per-cell a11y label of "<label> cell — <pct>% honey, tier <tier>"', () => {
    render(
      <Honeycomb
        size="strip"
        cells={[{ categoryId: 'cleaning', label: 'Cleaning', sharpness: 78, tier: 'Ripening' }]}
      />,
    );

    expect(screen.getByLabelText('Cleaning cell — 78% honey, tier Ripening')).toBeOnTheScreen();
  });

  it('rounds sharpness in the a11y label', () => {
    render(
      <Honeycomb
        size="strip"
        cells={[{ categoryId: 'errands', label: 'Errands', sharpness: 40.6, tier: 'Setting' }]}
      />,
    );

    expect(screen.getByLabelText('Errands cell — 41% honey, tier Setting')).toBeOnTheScreen();
  });

  it('marks a fully-ripened cell (sharpness ≥ 93) as capped', () => {
    render(
      <Honeycomb
        size="detail"
        cells={[{ categoryId: 'focus', label: 'Focus', sharpness: 95, tier: 'Honest' }]}
      />,
    );

    // The cell exists and the wax-cap rim is rendered (the ripe / "Honest" state).
    expect(screen.getByTestId('honeycomb-cell-focus')).toBeOnTheScreen();
    expect(screen.getByTestId('honeycomb-cap-focus')).toBeOnTheScreen();
  });

  it('does NOT cap a still-ripening cell (sharpness < 93)', () => {
    render(
      <Honeycomb
        size="detail"
        cells={[{ categoryId: 'focus', label: 'Focus', sharpness: 92, tier: 'Thickening' }]}
      />,
    );

    expect(screen.getByTestId('honeycomb-cell-focus')).toBeOnTheScreen();
    // No wax-cap rim below the "Honest" threshold.
    expect(screen.queryByTestId('honeycomb-cap-focus')).toBeNull();
  });

  it('renders one cell per category', () => {
    render(
      <Honeycomb
        size="strip"
        cells={[
          { categoryId: 'a', label: 'Alpha', sharpness: 10, tier: 'Raw' },
          { categoryId: 'b', label: 'Beta', sharpness: 50, tier: 'Setting' },
          { categoryId: 'c', label: 'Gamma', sharpness: 90, tier: 'Thickening' },
        ]}
      />,
    );

    expect(screen.getByTestId('honeycomb-cell-a')).toBeOnTheScreen();
    expect(screen.getByTestId('honeycomb-cell-b')).toBeOnTheScreen();
    expect(screen.getByTestId('honeycomb-cell-c')).toBeOnTheScreen();
  });
});
