import { render } from '@testing-library/react-native';
import { RingBadge } from '../RingBadge';

describe('RingBadge', () => {
  it('shows tier, percent and the soft next pull', () => {
    const { getByText, queryByText } = render(<RingBadge sharpness={46} />);
    expect(getByText(/Setting/)).toBeTruthy();
    expect(getByText(/46%/)).toBeTruthy();
    expect(getByText(/Getting sharper/)).toBeTruthy();
    expect(getByText(/Ripening/)).toBeTruthy();
    expect(queryByText(/sealed/)).toBeNull();
  });
  it('shows the sealed hold state at the top', () => {
    const { getByText } = render(<RingBadge sharpness={95} />);
    expect(getByText(/Honeycomb sealed ✦/)).toBeTruthy();
  });
});
