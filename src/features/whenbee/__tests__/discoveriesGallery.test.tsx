import { render } from '@testing-library/react-native';
import { DiscoveriesGallery } from '../DiscoveriesGallery';
import type { Discovery } from '@/src/domain/types';

function disc(over: Partial<Discovery>): Discovery {
  return {
    id: 'd1',
    categoryId: 'admin',
    multiplier: 1.6,
    honestForFifteen: 24,
    headline: 'ignored',
    discoveredAt: 1,
    ...over,
  };
}

test('a longer discovery shows category, proof, multiplier and LONGER', () => {
  const { getByText } = render(<DiscoveriesGallery discoveries={[disc({})]} />);
  expect(getByText('Admin & email')).toBeTruthy();
  expect(getByText('You plan 15m · really runs ~24m')).toBeTruthy();
  expect(getByText('1.6')).toBeTruthy();
  expect(getByText('LONGER')).toBeTruthy();
});

test('a faster discovery shows the only-verb proof and FASTER', () => {
  const { getByText } = render(
    <DiscoveriesGallery
      discoveries={[disc({ id: 'd2', categoryId: 'writing', multiplier: 0.6, honestForFifteen: 9 })]}
    />,
  );
  expect(getByText('You plan 15m · really only ~9m')).toBeTruthy();
  expect(getByText('FASTER')).toBeTruthy();
});

test('empty list renders the invitation, not a card', () => {
  const { getByText } = render(<DiscoveriesGallery discoveries={[]} />);
  expect(getByText(/Nothing here yet/i)).toBeTruthy();
});
