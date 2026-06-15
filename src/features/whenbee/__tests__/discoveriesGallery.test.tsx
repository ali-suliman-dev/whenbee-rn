import { render } from '@testing-library/react-native';
import { DiscoveriesGallery } from '../DiscoveriesGallery';
import type { Discovery } from '@/src/domain/types';

const disc = (overrides: Partial<Discovery> = {}): Discovery => ({
  id: 'd1',
  categoryId: 'cleaning',
  multiplier: 1.9,
  honestForFifteen: 29,
  headline: '~29m vs your 15m guess · runs 1.9×',
  discoveredAt: 1,
  ...overrides,
});

describe('DiscoveriesGallery', () => {
  it('shows the invitational empty state with no discoveries', () => {
    const { getByText } = render(<DiscoveriesGallery discoveries={[]} />);
    expect(getByText(/Discoveries show up as Whenbee learns/i)).toBeTruthy();
  });

  it('renders one card per discovery, newest first', () => {
    const { getByText } = render(
      <DiscoveriesGallery
        discoveries={[disc({ id: 'b', headline: 'runs 2.5×' }), disc({ id: 'a', headline: 'runs 1.9×' })]}
      />,
    );
    expect(getByText('runs 2.5×')).toBeTruthy();
    expect(getByText('runs 1.9×')).toBeTruthy();
  });
});
