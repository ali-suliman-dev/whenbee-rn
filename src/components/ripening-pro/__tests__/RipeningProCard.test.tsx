import { render, fireEvent } from '@testing-library/react-native';
import i18n from '@/src/i18n';
import { RipeningProCard } from '../RipeningProCard';
import { RIPENING_COPY, REVEAL_COPY } from '../copy';
import type { ProFeatureId } from '@/src/engine';

const t = i18n.getFixedT('en', 'patterns');
// NOTE: RIPENING_COPY/REVEAL_COPY are called lazily (not at module scope) since
// i18n isn't initialized until jest.setup's beforeAll runs.
const ripeningCopy = () => RIPENING_COPY(t);
const revealCopy = () => REVEAL_COPY(t);

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
  expect(getByText(ripeningCopy().ticketTitle)).toBeTruthy();
  expect(getByText(ripeningCopy().ticketSub)).toBeTruthy();
  expect(getByText(ripeningCopy().chipLabel)).toBeTruthy();
  // Card renders its own footer copy
  expect(getByText(ripeningCopy().footer)).toBeTruthy();
  // No CTA button in ripening state
  expect(queryByText(revealCopy().cta)).toBeNull();
});

it('ripening state honey chip fires onSeePro', () => {
  const onSeePro = jest.fn();
  const { getByText } = render(
    <RipeningProCard {...base} pitchUnlocked={false} onSeePro={onSeePro} />,
  );
  fireEvent.press(getByText(ripeningCopy().chipLabel));
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
  expect(getByText(revealCopy().headline)).toBeTruthy();
  fireEvent.press(getByText(revealCopy().cta));
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
  fireEvent.press(getByText(revealCopy().escape));
  expect(onPreview).toHaveBeenCalled();
});
