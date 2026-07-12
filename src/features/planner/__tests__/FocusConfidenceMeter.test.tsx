import { render } from '@testing-library/react-native';
import { FocusConfidenceMeter } from '../FocusConfidenceMeter';

describe('FocusConfidenceMeter', () => {
  it('renders the tier label', () => {
    const { getByText } = render(<FocusConfidenceMeter tier="building" fill={0.64} />);
    expect(getByText('Building · getting sharper')).toBeTruthy();
  });

  it('renders the steady label at full fill', () => {
    const { getByText } = render(<FocusConfidenceMeter tier="steady" fill={1} />);
    expect(getByText('Steady · locked to your rhythm')).toBeTruthy();
  });
});
