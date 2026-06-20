import { render, fireEvent } from '@testing-library/react-native';
import { RipeningProCard } from '../RipeningProCard';
import { RIPENING_COPY, REVEAL_COPY } from '../copy';
import type { ProFeatureId } from '@/src/engine';

const base = {
  honeyPct: 30,
  tier: 'Setting',
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
  expect(getByText(RIPENING_COPY.settling)).toBeTruthy();
  // No CTA button in ripening state
  expect(queryByText(REVEAL_COPY.cta)).toBeNull();
});

it('reveal state shows the headline and fires onSeePro', () => {
  const onSeePro = jest.fn();
  const { getByText } = render(
    <RipeningProCard
      {...base}
      pitchUnlocked
      honeyPct={64}
      tier="Ripening"
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
      honeyPct={64}
      tier="Ripening"
      onPreview={onPreview}
    />,
  );
  fireEvent.press(getByText(REVEAL_COPY.escape));
  expect(onPreview).toHaveBeenCalled();
});
