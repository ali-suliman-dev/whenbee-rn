import { render } from '@testing-library/react-native';
import { FocusGateRow } from '../FocusGateRow';

describe('FocusGateRow', () => {
  it('done: shows the checked value and label, no pips', () => {
    const { getByText } = render(
      <FocusGateRow
        first
        state="done"
        label="Timed sessions"
        valueText="15 ✓"
        sub="Plenty logged for me to learn from."
      />,
    );
    expect(getByText('15 ✓')).toBeTruthy();
    expect(getByText('Timed sessions')).toBeTruthy();
    expect(getByText('Plenty logged for me to learn from.')).toBeTruthy();
  });

  it('active: two-tones have/need and renders the sub', () => {
    const { getByText } = render(
      <FocusGateRow
        state="active"
        label="Timed sessions"
        valueText="3/15"
        sub="12 more timed sessions to go."
        pips={{ filled: 3, total: 15 }}
      />,
    );
    // fraction is split into a numerator + faint denominator node
    expect(getByText('3')).toBeTruthy();
    expect(getByText('/15')).toBeTruthy();
    expect(getByText('12 more timed sessions to go.')).toBeTruthy();
  });

  it('upcoming: renders the muted value + sub as a single node', () => {
    const { getByText } = render(
      <FocusGateRow
        state="upcoming"
        label="A clear peak"
        valueText="0/6"
        sub="Last: your busiest stretch stands out."
      />,
    );
    expect(getByText('0/6')).toBeTruthy();
    expect(getByText('A clear peak')).toBeTruthy();
    expect(getByText('Last: your busiest stretch stands out.')).toBeTruthy();
  });
});
