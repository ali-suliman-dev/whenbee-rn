import { render, screen } from '@testing-library/react-native';
import { HonestCard } from '@/src/features/category-detail/HonestCard';

// B15 — the reason-aware note is DISPLAY-ONLY and ADDITIVE. It must never move
// the honest number. These tests render the same honest-number props twice —
// once without a note, once with one — and assert the number is byte-identical,
// proving the note can't reach into the calculation.

const base = {
  categoryName: 'Cleaning',
  honestMinutes: 28,
  multiplier: 2.0,
  provenance: 'based on your runs',
  tier: 'Setting',
  n: 4,
  logsToNext: 2,
  nextTier: 'Ripening' as const,
  confidence: 'honest' as const,
  range: null,
};

const NOTE = 'Most overruns here trace back to getting pulled away.';

describe('HonestCard — optional B15 reason note', () => {
  it('renders the honest number and NO note when reasonNote is omitted', () => {
    render(<HonestCard {...base} />);
    expect(screen.getByText('~28')).toBeOnTheScreen();
    expect(screen.queryByText(/trace back to/)).toBeNull();
  });

  it('renders the SAME honest number AND the note when reasonNote is supplied', () => {
    render(<HonestCard {...base} reasonNote={NOTE} />);
    // Identical number to the no-note branch — the note cannot move it.
    expect(screen.getByText('~28')).toBeOnTheScreen();
    expect(screen.getByText('2.0×')).toBeOnTheScreen();
    expect(screen.getByText(NOTE)).toBeOnTheScreen();
  });
});
