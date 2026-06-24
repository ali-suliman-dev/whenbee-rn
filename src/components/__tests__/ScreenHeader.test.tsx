import { render } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader eyebrow', () => {
  it('renders the eyebrow above the title when provided', () => {
    const { getByText } = render(<ScreenHeader title="Today" eyebrow="Good morning, Ali" />);
    expect(getByText('Good morning, Ali')).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
  });

  it('renders no eyebrow when not provided', () => {
    const { queryByText } = render(<ScreenHeader title="Today" />);
    expect(queryByText('Good morning, Ali')).toBeNull();
  });
});
