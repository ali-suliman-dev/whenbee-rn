import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ProTeaserCard } from '../ProTeaserCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

it('renders the benefit headline and routes to the paywall on CTA press', () => {
  const { getByText } = render(
    <ProTeaserCard eyebrow="Whenbee Pro" headline="Know your sharpest hours." sub="See when." cta="Reveal my rhythm" trigger="steals_your_time" preview="rhythm" />,
  );
  expect(getByText('Know your sharpest hours.')).toBeTruthy();
  fireEvent.press(getByText('Reveal my rhythm'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/(modals)/paywall', params: { trigger: 'steals_your_time' } });
});
