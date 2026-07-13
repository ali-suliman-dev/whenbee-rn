import { render } from '@testing-library/react-native';
import { FocusConfidenceMeter, nextConfidenceFillTarget } from '../FocusConfidenceMeter';

describe('FocusConfidenceMeter', () => {
  it('renders the tier label', () => {
    const { getByText } = render(<FocusConfidenceMeter tier="building" fill={0.64} />);
    expect(getByText('Building · getting sharper')).toBeTruthy();
  });

  it('renders the steady label at full fill', () => {
    const { getByText } = render(<FocusConfidenceMeter tier="steady" fill={1} />);
    expect(getByText('Steady · locked to your rhythm')).toBeTruthy();
  });

  it('renders without crashing when a subsequent render drops fill (honey is monotonic)', () => {
    // Full end-to-end animation state isn't observable through the Reanimated
    // jest mock (its useSharedValue isn't persisted across re-renders like
    // the real UI-thread implementation), so the monotonic clamp itself is
    // covered directly below via nextConfidenceFillTarget. This just proves
    // a dropping `fill` prop is a legal, non-crashing input.
    const { getByTestId, rerender } = render(<FocusConfidenceMeter tier="building" fill={0.8} />);
    expect(getByTestId('focus-confidence-fill')).toBeTruthy();
    rerender(<FocusConfidenceMeter tier="building" fill={0.3} />);
    expect(getByTestId('focus-confidence-fill')).toBeTruthy();
  });

  describe('nextConfidenceFillTarget', () => {
    it('grows the target from 0 on first fill', () => {
      expect(nextConfidenceFillTarget(0, 0.64)).toBe(0.64);
    });

    it('never lowers the target when the incoming fill drops', () => {
      const grown = nextConfidenceFillTarget(0, 0.8);
      expect(grown).toBe(0.8);
      const afterDrop = nextConfidenceFillTarget(grown, 0.3);
      expect(afterDrop).toBe(0.8);
      expect(afterDrop).toBeGreaterThanOrEqual(grown);
    });

    it('still advances the target when the incoming fill rises further', () => {
      const grown = nextConfidenceFillTarget(0.5, 0.9);
      expect(grown).toBe(0.9);
    });

    it('clamps incoming fill to [0,1] before comparing', () => {
      expect(nextConfidenceFillTarget(0.5, 1.4)).toBe(1);
      expect(nextConfidenceFillTarget(0.5, -0.2)).toBe(0.5);
    });
  });
});
