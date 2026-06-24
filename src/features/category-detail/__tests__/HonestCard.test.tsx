import { render, screen } from '@testing-library/react-native';
import { HonestCard } from '@/src/features/category-detail/HonestCard';

const base = {
  categoryName: 'Cleaning',
  honestMinutes: 30,
  multiplier: 2.0,
  provenance: 'based on your runs',
  tier: 'Setting',
  n: 2,
  logsToNext: 2,
  nextTier: 'Ripening' as const,
};

describe('HonestCard — range band hero', () => {
  it('shows the range, tier meaning, and maturity caption while learning (free)', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro={false} />);
    expect(screen.getByText('20–40')).toBeOnTheScreen();
    expect(screen.getByText('YOUR HONEST RANGE')).toBeOnTheScreen();
    expect(screen.getByText('still sharpening your pace')).toBeOnTheScreen();
    expect(screen.getByText(/4 more runs/)).toBeOnTheScreen();
    // Free: the precise convergence point is HIDDEN behind the Pro teaser — no ~30 leaked.
    expect(screen.queryByText('~30')).toBeNull();
    expect(screen.getByText('Pro')).toBeOnTheScreen();
    // No tight number / multiplier chip while learning.
    expect(screen.queryByText('2.0')).toBeNull();
  });

  it('uses the raw tier meaning for raw confidence', () => {
    render(<HonestCard {...base} n={1} confidence="raw" range={{ lowMinutes: 20, highMinutes: 45 }} />);
    expect(screen.getByText('just getting to know your pace')).toBeOnTheScreen();
  });

  it('shows the narrowing proof for Pro with a wider prior range', () => {
    render(
      <HonestCard
        {...base}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 40 }}
        isPro
        firstHonestRange={{ lowMinutes: 10, highMinutes: 55 }}
      />,
    );
    expect(screen.getByText(/Tightened from 10–55/)).toBeOnTheScreen();
  });

  it('shows the tight number, multiplier, and affirmation once honest', () => {
    render(<HonestCard {...base} confidence="honest" range={null} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    // A design: multiplier folds into the quiet meta line ("2.0× your guess").
    expect(screen.getByText('2.0×')).toBeOnTheScreen();
    expect(screen.getByText('honest now')).toBeOnTheScreen();
    // A design: eyebrow removed — the number speaks for itself.
    expect(screen.queryByText('YOUR HONEST NUMBER')).toBeNull();
  });

  it('falls back to the tight number when confidence is omitted (back-compat)', () => {
    render(<HonestCard {...base} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('2.0×')).toBeOnTheScreen();
    // Not honest → no seal in the meta line.
    expect(screen.queryByText('honest now')).toBeNull();
  });

  it('hides the precise convergence tick from free users (Pro gate)', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro={false} />);
    expect(screen.queryByTestId('convergence-tick')).toBeNull();
  });

  it('shows the precise convergence tick for Pro users', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro />);
    expect(screen.getByTestId('convergence-tick')).toBeOnTheScreen();
  });
});
