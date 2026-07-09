import { render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { FocusGateRow } from '../FocusGateRow';

describe('FocusGateRow', () => {
  afterEach(() => jest.restoreAllMocks());

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

  describe('motion', () => {
    it('done renders the drawn checkmark and copy in reduced motion', () => {
      jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
      // The ✓ is now an inline SVG stroke (not an icon font glyph). Rendering the
      // done row mounts that SVG; if it threw, this render would throw. The row
      // still shows its value + copy at the final state.
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
      expect(getByText('Plenty logged for me to learn from.')).toBeTruthy();
    });

    it('active renders all filled pips with no thrown error (reduced motion)', () => {
      jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
      const { getByText } = render(
        <FocusGateRow
          state="active"
          label="Days with a session"
          valueText="5/5"
          sub="Nearly there."
          pips={{ filled: 5, total: 5 }}
        />,
      );
      expect(getByText('5')).toBeTruthy();
      expect(getByText('/5')).toBeTruthy();
      expect(getByText('Nearly there.')).toBeTruthy();
    });

    it('re-renders cleanly when a pip fills (active, normal motion)', () => {
      const { rerender, getByText } = render(
        <FocusGateRow
          state="active"
          label="Timed sessions"
          valueText="3/15"
          sub="12 more timed sessions to go."
          pips={{ filled: 3, total: 15 }}
        />,
      );
      rerender(
        <FocusGateRow
          state="active"
          label="Timed sessions"
          valueText="4/15"
          sub="11 more timed sessions to go."
          pips={{ filled: 4, total: 15 }}
        />,
      );
      expect(getByText('4')).toBeTruthy();
      expect(getByText('11 more timed sessions to go.')).toBeTruthy();
    });
  });
});
