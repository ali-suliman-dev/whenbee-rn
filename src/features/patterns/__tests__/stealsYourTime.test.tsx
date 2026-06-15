import { render, screen } from '@testing-library/react-native';
import { StealsYourTime } from '@/src/features/patterns/StealsYourTime';
import type { ReasonInsight } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// StealsYourTime card: empty insights → renders nothing; a populated insight →
// renders the blame-free detail line (with the afternoon skew tail) and the
// on-device provenance ("Based on N of M …"). No callout, no shame.
// ──────────────────────────────────────────────────────────────────────────────

function insight(over: Partial<ReasonInsight> = {}): ReasonInsight {
  return {
    categoryId: 'admin',
    categoryName: 'Admin & email',
    reason: 'interrupted',
    share: 0.6,
    sampleCount: 6,
    totalOver: 9,
    timeSkew: 'afternoon',
    weekdaySkew: null,
    ...over,
  };
}

describe('StealsYourTime', () => {
  it('renders nothing when there are no insights', () => {
    const { toJSON } = render(<StealsYourTime insights={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the blame-free detail line with the afternoon skew', () => {
    render(<StealsYourTime insights={[insight()]} />);

    // pct = round(0.6 * 100) = 60; reasonPhrase('interrupted') = 'getting interrupted';
    // afternoon → ", mostly later in the day".
    expect(
      screen.getByText(
        '60% of Admin & email overruns trace back to getting interrupted, mostly later in the day.',
      ),
    ).toBeOnTheScreen();
  });

  it('renders the on-device provenance line', () => {
    render(<StealsYourTime insights={[insight()]} />);

    expect(
      screen.getByText('Based on 6 of 9 times you noted why · learned on-device'),
    ).toBeOnTheScreen();
  });
});
