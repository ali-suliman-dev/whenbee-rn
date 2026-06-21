import { render } from '@testing-library/react-native';
import { DiscoveriesPreviewCard } from '../DiscoveriesPreviewCard';
import type { Discovery } from '@/src/domain/types';

function disc(over: Partial<Discovery>): Discovery {
  return {
    id: 'd1',
    categoryId: 'getting_ready',
    multiplier: 2.3,
    honestForFifteen: 35,
    headline: 'ignored',
    discoveredAt: 2,
    ...over,
  };
}

test('features the latest discovery with count, multiplier and sentence', () => {
  const { getByText, queryByText } = render(
    <DiscoveriesPreviewCard discoveries={[disc({})]} discoveryCount={1} />,
  );
  expect(getByText('LATEST DISCOVERY')).toBeTruthy();
  expect(getByText('1 banked')).toBeTruthy();
  expect(getByText('2.3')).toBeTruthy();
  expect(getByText('Getting ready')).toBeTruthy();
  expect(getByText('You plan 15 minutes — it really takes about 35.')).toBeTruthy();
  expect(getByText('See all 1')).toBeTruthy();
  // single discovery → no "+N more"
  expect(queryByText(/more/)).toBeNull();
});

test('shows +N more when the count exceeds one', () => {
  const { getByText } = render(
    <DiscoveriesPreviewCard discoveries={[disc({})]} discoveryCount={3} />,
  );
  expect(getByText('+2 more')).toBeTruthy();
  expect(getByText('See all 3')).toBeTruthy();
});
