import { render, fireEvent } from '@testing-library/react-native';
import { RipeningProCard } from '../RipeningProCard';
import { RIPENING_COPY, REVEAL_COPY } from '../copy';
import type { ProFeatureId } from '@/src/engine';

const base = {
  nextTierName: 'Ripening',
  logsToNext: 3,
  features: [
    { id: 'confidence-band' as ProFeatureId, ready: false, progress: 0.4 },
    { id: 'steals-your-time' as ProFeatureId, ready: false, waitLabel: '3 logs to go' },
  ],
  onSeePro: jest.fn(),
  onPreview: jest.fn(),
};

it('ripening state shows the ticket-strip copy, footer and no CTA', () => {
  const { queryByText, getByText } = render(
    <RipeningProCard {...base} pitchUnlocked={false} />,
  );
  // Zero-ready header title (both features not ready in `base`)
  expect(getByText('Your Pro features are on the way.')).toBeTruthy();
  // Ticket strip copy
  expect(getByText(RIPENING_COPY.ticketTitle)).toBeTruthy();
  expect(getByText(RIPENING_COPY.ticketSub)).toBeTruthy();
  expect(getByText(RIPENING_COPY.chipLabel)).toBeTruthy();
  // Card renders its own footer copy
  expect(getByText(RIPENING_COPY.footer)).toBeTruthy();
  // No CTA button in ripening state
  expect(queryByText(REVEAL_COPY.cta)).toBeNull();
});

it('ripening state honey chip fires onSeePro', () => {
  const onSeePro = jest.fn();
  const { getByText } = render(
    <RipeningProCard {...base} pitchUnlocked={false} onSeePro={onSeePro} />,
  );
  fireEvent.press(getByText(RIPENING_COPY.chipLabel));
  expect(onSeePro).toHaveBeenCalled();
});

it('ripening state shows the tally caption for ready count out of total', () => {
  const { getByText } = render(
    <RipeningProCard
      {...base}
      pitchUnlocked={false}
      features={[
        { id: 'confidence-band' as ProFeatureId, ready: true },
        { id: 'steals-your-time' as ProFeatureId, ready: false, waitLabel: '3 logs to go' },
      ]}
    />,
  );
  expect(getByText('1 of 2')).toBeTruthy();
  expect(getByText('Your first Pro feature is ready.')).toBeTruthy();
});

it('reveal state shows the headline and fires onSeePro', () => {
  const onSeePro = jest.fn();
  const { getByText } = render(
    <RipeningProCard
      {...base}
      pitchUnlocked
      onSeePro={onSeePro}
    />,
  );
  expect(getByText(REVEAL_COPY.headline)).toBeTruthy();
  fireEvent.press(getByText(REVEAL_COPY.cta));
  expect(onSeePro).toHaveBeenCalled();
});

it('reveal state fires onPreview when escape link is pressed', () => {
  const onPreview = jest.fn();
  const { getByText } = render(
    <RipeningProCard
      {...base}
      pitchUnlocked
      onPreview={onPreview}
    />,
  );
  fireEvent.press(getByText(REVEAL_COPY.escape));
  expect(onPreview).toHaveBeenCalled();
});
