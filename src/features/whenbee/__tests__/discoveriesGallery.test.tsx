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

test('renders discoveries in the order they are passed (newest-first contract)', () => {
  const first = disc({ id: 'd-first', categoryId: 'admin', honestForFifteen: 24 });
  const second = disc({ id: 'd-second', categoryId: 'writing', honestForFifteen: 9 });
  const json = JSON.stringify(
    render(<DiscoveriesGallery discoveries={[first, second]} />).toJSON(),
  );
  const posFirst = json.indexOf('Admin & email');
  const posSecond = json.indexOf('Writing');
  expect(posFirst).toBeGreaterThan(-1);
  expect(posSecond).toBeGreaterThan(-1);
  expect(posFirst).toBeLessThan(posSecond);
});

test('card has a composed accessibilityLabel for screen readers (longer discovery)', () => {
  const { getByLabelText } = render(<DiscoveriesGallery discoveries={[disc({})]} />);
  expect(getByLabelText(/Admin & email runs 1\.6 times longer/)).toBeTruthy();
});
