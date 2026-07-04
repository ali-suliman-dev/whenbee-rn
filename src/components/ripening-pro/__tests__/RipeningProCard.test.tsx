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
  honeyPct: 30,
  nextTierName: 'Ripening',
  logsToNext: 3,
  features: [{ id: 'confidence-band' as ProFeatureId, ready: false, waitLabel: 'soon' }],
  onSeePro: jest.fn(),
  onPreview: jest.fn(),
};

it('ripening state shows the settling copy and no CTA', () => {
  const { queryByText, getByText } = render(
    <RipeningProCard {...base} pitchUnlocked={false} />,
  );
  // RipeningBand renders the settling label
  expect(getByText(ripeningCopy().settling)).toBeTruthy();
  // Card renders its own footer copy
  expect(getByText(ripeningCopy().footer)).toBeTruthy();
  // No CTA button in ripening state
  expect(queryByText(revealCopy().cta)).toBeNull();
});

it('reveal state shows the headline and fires onSeePro', () => {
  const onSeePro = jest.fn();
  const { getByText } = render(
    <RipeningProCard
      {...base}
      pitchUnlocked
      honeyPct={64}
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
      honeyPct={64}
      onPreview={onPreview}
    />,
  );
  fireEvent.press(getByText(revealCopy().escape));
  expect(onPreview).toHaveBeenCalled();
});
